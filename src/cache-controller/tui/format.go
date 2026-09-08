package main

import (
	"fmt"
	"strings"

	pb "github.com/odritaa/LumInsieme/src/cache-controller/pb"
)

func formatHealth(resp *pb.HealthResponse) string {
	status := successStyle.Render(resp.Status)
	redis := "connected"
	if !resp.RedisConnected {
		redis = errorStyle.Render("disconnected")
	}
	return fmt.Sprintf("Status: %s\nRedis: %s", status, redis)
}

func formatGet(key string, resp *pb.GetResponse) string {
	if !resp.Found {
		return fmt.Sprintf("Key: %s\n%s", keyStyle.Render(key), errorStyle.Render("NOT FOUND"))
	}
	return fmt.Sprintf("Key: %s\nValue: %s", keyStyle.Render(key), valueStyle.Render(resp.Value))
}

func formatSet(key, value string, ok bool) string {
	return fmt.Sprintf("Set %s = %s: %s",
		keyStyle.Render(key),
		valueStyle.Render(value),
		successStyle.Render("OK"),
	)
}

func formatDelete(key string, deleted bool) string {
	status := successStyle.Render("deleted")
	if !deleted {
		status = errorStyle.Render("not found")
	}
	return fmt.Sprintf("Delete %s: %s", keyStyle.Render(key), status)
}

func formatExists(key string, exists bool) string {
	status := successStyle.Render("YES")
	if !exists {
		status = errorStyle.Render("NO")
	}
	return fmt.Sprintf("Key %s exists: %s", keyStyle.Render(key), status)
}

func formatSetTTL(key string, ttl int64, ok bool) string {
	return fmt.Sprintf("Set TTL for %s to %s: %s",
		keyStyle.Render(key),
		valueStyle.Render(fmt.Sprintf("%ds", ttl)),
		successStyle.Render("OK"),
	)
}

func formatGetTTL(key string, ttl int64) string {
	if ttl < 0 {
		return fmt.Sprintf("TTL for %s: %s", keyStyle.Render(key), errorStyle.Render("no TTL set"))
	}
	return fmt.Sprintf("TTL for %s: %s",
		keyStyle.Render(key),
		valueStyle.Render(fmt.Sprintf("%ds", ttl)),
	)
}

func formatPush(key, value string, length int64) string {
	return fmt.Sprintf("Pushed to %s: %s\nList length: %s",
		keyStyle.Render(key),
		valueStyle.Render(value),
		valueStyle.Render(fmt.Sprintf("%d", length)),
	)
}

func formatRange(key string, values []string) string {
	if len(values) == 0 {
		return fmt.Sprintf("List %s: %s", keyStyle.Render(key), errorStyle.Render("empty"))
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("List %s:\n", keyStyle.Render(key)))
	for i, v := range values {
		b.WriteString(fmt.Sprintf("  %s %s\n",
			valueStyle.Render(fmt.Sprintf("[%d]", i)),
			valueStyle.Render(v),
		))
	}
	return strings.TrimRight(b.String(), "\n")
}

func formatHSet(key, field, value string, ok bool) string {
	return fmt.Sprintf("HSet %s[%s] = %s: %s",
		keyStyle.Render(key),
		valueStyle.Render(field),
		valueStyle.Render(value),
		successStyle.Render("OK"),
	)
}

func formatHGet(key, field, value string, found bool) string {
	if !found {
		return fmt.Sprintf("HGet %s[%s]: %s",
			keyStyle.Render(key),
			valueStyle.Render(field),
			errorStyle.Render("NOT FOUND"),
		)
	}
	return fmt.Sprintf("HGet %s[%s]: %s",
		keyStyle.Render(key),
		valueStyle.Render(field),
		valueStyle.Render(value),
	)
}

func formatHGetAll(key string, fields map[string]string) string {
	if len(fields) == 0 {
		return fmt.Sprintf("Hash %s: %s", keyStyle.Render(key), errorStyle.Render("empty"))
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Hash %s:\n", keyStyle.Render(key)))
	for k, v := range fields {
		b.WriteString(fmt.Sprintf("  %s: %s\n",
			valueStyle.Render(k),
			valueStyle.Render(v),
		))
	}
	return strings.TrimRight(b.String(), "\n")
}

func formatHDel(key, field string, deleted bool) string {
	status := successStyle.Render("deleted")
	if !deleted {
		status = errorStyle.Render("not found")
	}
	return fmt.Sprintf("HDel %s[%s]: %s",
		keyStyle.Render(key),
		valueStyle.Render(field),
		status,
	)
}

func formatPublish(channel string, subscribers int64) string {
	return fmt.Sprintf("Published to %s\nSubscribers received: %s",
		keyStyle.Render(channel),
		valueStyle.Render(fmt.Sprintf("%d", subscribers)),
	)
}

func formatSubscribeStart(channel string) string {
	return fmt.Sprintf("Subscribed to %s\nWaiting for messages... (Ctrl+C to exit)",
		keyStyle.Render(channel),
	)
}
