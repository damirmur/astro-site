//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: migrate <database-url>")
		fmt.Println("")
		fmt.Println("Apply all migrations from ./migrations to PocketBase.")
		fmt.Printf("Example: go run %s postgres://user:pass@localhost:8090/pocketbase\n",
			filepath.Base(os.Args[0]))
		os.Exit(1)
	}

	dbURL := os.Args[1]
	migrationsDir := "./migrations"

	// Get absolute path of the script directory
	_, currentFile, _, _ := runtime.Caller(0)
	scriptDir := filepath.Join(filepath.Dir(currentFile), migrationsDir)

	// Find all .go migration files
	files, err := filepath.Glob(filepath.Join(scriptDir, "*.go"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error finding migration files: %v\n", err)
		os.Exit(1)
	}

	if len(files) == 0 {
		fmt.Println("No migration files found in ", scriptDir)
		os.Exit(1)
	}

	// Sort files by name (they are already named with timestamps)
	sort.Slice(files, func(i, j int) bool {
		return files[i] < files[j]
	})

	fmt.Printf("Found %d migration file(s):\n", len(files))
	for _, f := range files {
		fmt.Println(f)
	}
	fmt.Println()

	// Execute each migration
	for _, file := range files {
		fmt.Printf("Applying migration: %s\n", filepath.Base(file))
		cmd := fmt.Sprintf(
			"go run -tags migrations %s",
			filepath.Join(filepath.Dir(currentFile), "migrate_cmd.go"),
		)

		err = execCommand(cmd, dbURL, file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to apply migration %s: %v\n", filepath.Base(file), err)
			os.Exit(1)
	}
	fmt.Println()
	_ = files // prevent unused variable warning
}

func execCommand(cmd string, dbURL, file string) error {
	// Create a temporary migration command that can be reused
	return nil
}