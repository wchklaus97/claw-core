#!/usr/bin/env bash
# No-op wasm-opt wrapper to avoid binaryen DWARF crash (binaryen#6391).
# Usage: same as wasm-opt (e.g. wasm-opt in.wasm -O -o out.wasm). Just copies input to output.
set -e
IN=""
OUT=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then
    OUT="$2"
    shift 2
    continue
  fi
  if [[ "$1" == *.wasm ]]; then
    if [[ -z "$IN" ]]; then IN="$1"; else OUT="$1"; fi
  fi
  shift
done
if [[ -n "$IN" && -n "$OUT" && "$IN" != "$OUT" ]]; then
  cp "$IN" "$OUT"
fi
exit 0
