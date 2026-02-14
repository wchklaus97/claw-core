#!/bin/bash
# Test if fork works with current FD situation
echo "Testing fork capability..."
for i in {1..5}; do
  echo "Test $i: $(date)" | sh -c 'cat' && echo "  ✅ Fork $i OK" || echo "  ❌ Fork $i FAILED"
done
echo "Fork test complete"
