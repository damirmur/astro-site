package astrology

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type AiConfig struct {
	Endpoint     string  `json:"endpoint"`
	ModelID      string  `json:"model_id"`
	ApiKey       string  `json:"api_key"`
	Temperature  float64 `json:"temperature"`
	SystemPrompt string  `json:"system_prompt"`
}

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
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", cfg.Endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	
	// ЗАЩИТА: Автоматически форматируем API-ключ
	if cfg.ApiKey != "" {
		token := cfg.ApiKey
		// Если ключ в БД записан без "Bearer ", добавляем его принудительно
		if !strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = "Bearer " + token
		}
		req.Header.Set("Authorization", token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ИИ-сервер по адресу %s недоступен: %v", cfg.Endpoint, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ИИ-сервер вернул статус: %d", resp.StatusCode)
	}

	var openAIResp OpenAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return "", err
	}

	if len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("модель вернула пустой ответ")
	}

	return openAIResp.Choices[0].Message.Content, nil
}
