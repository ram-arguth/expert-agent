#!/bin/bash
set -e

TEST_File=$1
TARGET_URL=${2:-"http://localhost:3000"}

if [ -z "$TEST_File" ]; then
  echo "Usage: ./scripts/run-load-test.sh <test-file> [target-url]"
  echo "Example: ./scripts/run-load-test.sh load-tests/smoke-test.js https://expert-ai-gamma-xyz.a.run.app"
  exit 1
fi

if ! command -v k6 &> /dev/null; then
  echo "Error: k6 is not installed."
  echo "Please install k6: https://k6.io/docs/get-started/installation/"
  exit 1
fi

echo "Running load test: $TEST_File"
echo "Target URL: $TARGET_URL"

k6 run -e BASE_URL="$TARGET_URL" "$TEST_File"
