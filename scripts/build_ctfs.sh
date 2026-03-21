#!/bin/bash
set -e

echo "======================================"
echo "🏗️  BUILDING CTF DOCKER IMAGES..."
echo "======================================"

if [ ! -d "ctfs" ]; then
  echo "No 'ctfs/' directory found. Skipping."
  exit 0
fi

cd ctfs
for d in */ ; do
  if [ -d "$d" ]; then
    # Remove trailing slash
    dirname=${d%/}
    echo "--------------------------------------"
    echo "🚀 Building image for CTF: $dirname"
    echo "--------------------------------------"
    docker build -t "$dirname" "$dirname"
  fi
done

echo "✅ All CTF images built successfully."
