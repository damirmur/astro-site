package models

type AiConfig struct {
	Endpoint     string  `json:"endpoint"`
	ModelID      string  `json:"model_id"`
	ApiKey       string  `json:"api_key"`
	Temperature  float64 `json:"temperature"`
	SystemPrompt string  `json:"system_prompt"`
}

type InterpretRequest struct {
	Type    string `json:"type"`
	NatalID string `json:"natal_id"`
}

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

type OpenAIRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

func GetPromptText(app core.App, promptType string, replacements map[string]string) string {
	fallbackPrompts := map[string]string{
		"natal":   "Разбери натальную карту JSON: %s",
		"transit": "Разбери транзит JSON: %s",
		"full":    "Разбери совмещение натала и транзита.",
	}

	records, err := app.FindRecordsByFilter("ai_prompts", "type = '"+promptType+"'", "", 1, 0)
	if err != nil || len(records) == 0 {
		return fallbackPrompts[promptType]
	}

	text := records[0].GetString("prompt_text")
	for placeholder, value := range replacements {
		text = strings.ReplaceAll(text, placeholder, value)
	}
	return text
}

func AskGemma(ctx context.Context, cfg AiConfig, userPrompt string) (string, error) {
	client := &http.Client{Timeout: 120 * time.Second}
	
	reqBody := OpenAIRequest{
		Model:       cfg.ModelID,
		Messages: []Message{
			{Role: "system", Content: cfg.SystemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: cfg.Temperature,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil { return "", err }

	req, err := http.NewRequestWithContext(ctx, "POST", cfg.Endpoint, bytes.NewBuffer(jsonData))
	if err != nil { return "", err }
	req.Header.Set("Content-Type", "application/json")
	
	if cfg.ApiKey != "" {
		token := cfg.ApiKey
		if !strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = "Bearer " + token
		}
		req.Header.Set("Authorization", token)
	}

	resp, err := client.Do(req)
	if err != nil { return "", fmt.Errorf("ИИ-сервер недоступен: %v", err) }
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK { return "", fmt.Errorf("ИИ-сервер вернул статус: %d", resp.StatusCode) }

	var openAIResp OpenAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil { return "", err }

	if len(openAIResp.Choices) == 0 { return "", fmt.Errorf("модель вернула пустой ответ") }

	return openAIResp.Choices[0].Message.Content, nil
}
