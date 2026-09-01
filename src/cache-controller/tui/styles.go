package main

import "charm.land/lipgloss/v2"

var (
	appTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("63")).
			MarginBottom(1)

	inputLabel = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212"))

	resultHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("46"))

	statusBar = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			Italic(true)

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Bold(true)

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("46")).
			Bold(true)

	keyStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("214")).
			Bold(true)

	valueStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252"))

	categoryStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("99")).
			Faint(true)
)
