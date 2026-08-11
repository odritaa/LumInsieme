package main

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/bubbles/v2/list"
	"charm.land/bubbles/v2/spinner"
	"charm.land/bubbles/v2/textinput"
	"charm.land/bubbles/v2/viewport"
	"charm.land/lipgloss/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/odritaa/LumInsieme/src/cache-controller/pb"
)

type appState int

const (
	stateMenu appState = iota
	stateInput
	stateExecuting
	stateResult
)

type operationItem struct {
	op Operation
}

func (i operationItem) FilterValue() string { return i.op.Name }
func (i operationItem) Title() string {
	cat := categoryStyle.Render(fmt.Sprintf("[%s]", i.op.Category))
	return fmt.Sprintf("%s %s", i.op.Name, cat)
}
func (i operationItem) Description() string { return i.op.Description }

type grpcResultMsg struct {
	result string
	err    error
}

type model struct {
	state      appState
	list       list.Model
	inputs     []textinput.Model
	inputIdx   int
	result     string
	spinner    spinner.Model
	viewport   viewport.Model
	operations []Operation
	conn       *grpc.ClientConn
	client     pb.CacheServiceClient
	width      int
	height     int
}

func initialModel(addr string) model {
	operations := getOperations()

	items := make([]list.Item, len(operations))
	for i, op := range operations {
		items[i] = operationItem{op: op}
	}

	l := list.New(items, list.NewDefaultDelegate(), 0, 0)
	l.Title = "CacheService gRPC Operations"
	l.SetShowStatusBar(true)
	l.SetFilteringEnabled(true)
	l.Styles.Title = appTitle

	sp := spinner.New()
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	vp := viewport.New()

	conn, err := grpc.NewClient(addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	var client pb.CacheServiceClient
	if err == nil {
		client = pb.NewCacheServiceClient(conn)
	}

	return model{
		state:      stateMenu,
		list:       l,
		spinner:    sp,
		viewport:   vp,
		operations: operations,
		conn:       conn,
		client:     client,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.list.SetWidth(msg.Width)
		m.list.SetHeight(msg.Height - 4)
		m.viewport.SetWidth(msg.Width - 4)
		m.viewport.SetHeight(msg.Height - 8)
		return m, nil

	case tea.KeyPressMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}

	case grpcResultMsg:
		if msg.err != nil {
			m.result = errorStyle.Render(fmt.Sprintf("Error: %v", msg.err))
		} else {
			m.result = msg.result
		}
		m.viewport.SetContent(m.result)
		m.state = stateResult
		return m, nil
	}

	switch m.state {
	case stateMenu:
		return m.updateMenu(msg)
	case stateInput:
		return m.updateInput(msg)
	case stateExecuting:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	case stateResult:
		var cmd tea.Cmd
		m.viewport, cmd = m.viewport.Update(msg)
		cmds = append(cmds, cmd)

		if msg, ok := msg.(tea.KeyPressMsg); ok {
			switch msg.String() {
			case "q", "esc", "enter", "backspace":
				m.state = stateMenu
				return m, nil
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m model) updateMenu(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		if msg.String() == "enter" {
			if i, ok := m.list.SelectedItem().(operationItem); ok {
				op := i.op
				if len(op.Fields) == 0 {
					m.state = stateExecuting
					m.spinner.Tick()
					return m, tea.Batch(m.spinner.Tick, m.executeGRPC(op, nil))
				}

				m.inputs = make([]textinput.Model, len(op.Fields))
				for j, field := range op.Fields {
					ti := textinput.New()
					ti.Placeholder = field.Placeholder
					ti.CharLimit = 256
					if j == 0 {
						ti.Focus()
					}
					m.inputs[j] = ti
				}
				m.inputIdx = 0
				m.state = stateInput
				return m, textinput.Blink
			}
		}
	}

	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

func (m model) updateInput(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		switch msg.String() {
		case "enter":
			m.state = stateExecuting
			m.spinner.Tick()

			inputs := make([]string, len(m.inputs))
			for j, ti := range m.inputs {
				inputs[j] = ti.Value()
			}

			if i, ok := m.list.SelectedItem().(operationItem); ok {
				return m, tea.Batch(m.spinner.Tick, m.executeGRPC(i.op, inputs))
			}

		case "esc":
			m.state = stateMenu
			return m, nil

		case "tab":
			if m.inputIdx < len(m.inputs)-1 {
				m.inputs[m.inputIdx].Blur()
				m.inputIdx++
				m.inputs[m.inputIdx].Focus()
				return m, textinput.Blink
			}

		case "shift+tab":
			if m.inputIdx > 0 {
				m.inputs[m.inputIdx].Blur()
				m.inputIdx--
				m.inputs[m.inputIdx].Focus()
				return m, textinput.Blink
			}
		}
	}

	var cmd tea.Cmd
	m.inputs[m.inputIdx], cmd = m.inputs[m.inputIdx].Update(msg)
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

func (m model) executeGRPC(op Operation, inputs []string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return grpcResultMsg{err: fmt.Errorf("no hay conexion al servidor gRPC")}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var result string
		var err error

		switch op.Name {
		case "Health":
			resp, e := m.client.Health(ctx, &pb.HealthRequest{})
			err = e
			if err == nil {
				result = formatHealth(resp)
			}

		case "Get":
			resp, e := m.client.Get(ctx, &pb.GetRequest{Key: inputs[0]})
			err = e
			if err == nil {
				result = formatGet(inputs[0], resp)
			}

		case "Set":
			resp, e := m.client.Set(ctx, &pb.SetRequest{Key: inputs[0], Value: inputs[1]})
			err = e
			if err == nil {
				result = formatSet(inputs[0], inputs[1], resp.Ok)
			}

		case "Delete":
			resp, e := m.client.Delete(ctx, &pb.DeleteRequest{Key: inputs[0]})
			err = e
			if err == nil {
				result = formatDelete(inputs[0], resp.Deleted)
			}

		case "Exists":
			resp, e := m.client.Exists(ctx, &pb.ExistsRequest{Key: inputs[0]})
			err = e
			if err == nil {
				result = formatExists(inputs[0], resp.Exists)
			}

		case "SetTTL":
			ttl, e := strconv.ParseInt(inputs[1], 10, 64)
			if e != nil {
				return grpcResultMsg{err: fmt.Errorf("TTL must be a number: %v", e)}
			}
			resp, e := m.client.SetTTL(ctx, &pb.SetTTLRequest{Key: inputs[0], TtlSeconds: ttl})
			err = e
			if err == nil {
				result = formatSetTTL(inputs[0], ttl, resp.Ok)
			}

		case "GetTTL":
			resp, e := m.client.GetTTL(ctx, &pb.GetTTLRequest{Key: inputs[0]})
			err = e
			if err == nil {
				result = formatGetTTL(inputs[0], resp.TtlSeconds)
			}

		case "Push":
			resp, e := m.client.Push(ctx, &pb.PushRequest{Key: inputs[0], Value: inputs[1]})
			err = e
			if err == nil {
				result = formatPush(inputs[0], inputs[1], resp.Length)
			}

		case "Range":
			start, _ := strconv.ParseInt(inputs[1], 10, 64)
			stop, _ := strconv.ParseInt(inputs[2], 10, 64)
			resp, e := m.client.Range(ctx, &pb.RangeRequest{Key: inputs[0], Start: start, Stop: stop})
			err = e
			if err == nil {
				result = formatRange(inputs[0], resp.Values)
			}

		case "HSet":
			resp, e := m.client.HSet(ctx, &pb.HSetRequest{Key: inputs[0], Field: inputs[1], Value: inputs[2]})
			err = e
			if err == nil {
				result = formatHSet(inputs[0], inputs[1], inputs[2], resp.Ok)
			}

		case "HGet":
			resp, e := m.client.HGet(ctx, &pb.HGetRequest{Key: inputs[0], Field: inputs[1]})
			err = e
			if err == nil {
				result = formatHGet(inputs[0], inputs[1], resp.Value, resp.Found)
			}

		case "HGetAll":
			resp, e := m.client.HGetAll(ctx, &pb.HGetAllRequest{Key: inputs[0]})
			err = e
			if err == nil {
				result = formatHGetAll(inputs[0], resp.Fields)
			}

		case "HDel":
			resp, e := m.client.HDel(ctx, &pb.HDelRequest{Key: inputs[0], Field: inputs[1]})
			err = e
			if err == nil {
				result = formatHDel(inputs[0], inputs[1], resp.Deleted)
			}

		case "Publish":
			resp, e := m.client.Publish(ctx, &pb.PublishRequest{Channel: inputs[0], Message: inputs[1]})
			err = e
			if err == nil {
				result = formatPublish(inputs[0], resp.Subscribers)
			}

		case "Subscribe":
			stream, e := m.client.Subscribe(ctx, &pb.SubscribeRequest{Channel: inputs[0]})
			err = e
			if err == nil {
				result = formatSubscribeStart(inputs[0])
				go func() {
					for {
						_, e := stream.Recv()
						if e != nil {
							return
						}
					}
				}()
			}
		}

		return grpcResultMsg{result: result, err: err}
	}
}

func (m model) View() tea.View {
	var b strings.Builder

	switch m.state {
	case stateMenu:
		b.WriteString("\n")
		b.WriteString(m.list.View())
		b.WriteString("\n")
		b.WriteString(statusBar.Render("[/] Filter  [Enter] Select  [Ctrl+C] Quit"))

	case stateInput:
		b.WriteString("\n  ")
		b.WriteString(inputLabel.Render("Enter parameters:"))
		b.WriteString("\n\n")

		if i, ok := m.list.SelectedItem().(operationItem); ok {
			for j, input := range m.inputs {
				if j < len(i.op.Fields) {
					label := inputLabel.Render(i.op.Fields[j].Title + ":")
					b.WriteString(fmt.Sprintf("  %s %s\n\n", label, input.View()))
				}
			}
		}

		b.WriteString("  ")
		b.WriteString(statusBar.Render("[Enter] Submit  [Esc] Back  [Tab] Next field"))

	case stateExecuting:
		b.WriteString("\n  ")
		b.WriteString(m.spinner.View())
		b.WriteString(" Executing gRPC call...\n")

	case stateResult:
		b.WriteString("\n  ")
		b.WriteString(resultHeader.Render("Result:"))
		b.WriteString("\n\n")
		b.WriteString(m.viewport.View())
		b.WriteString("\n\n  ")
		b.WriteString(statusBar.Render("[Enter/q/Esc] Back to menu"))
	}

	v := tea.NewView(b.String())
	v.AltScreen = true
	return v
}
