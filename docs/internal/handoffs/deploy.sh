#!/bin/bash
# AI喵搭 — Cloudflare Pages 一键部署脚本
# 用法: source .env && ./deploy.sh

set -e

echo "📦 Building..."
npx vite build

echo ""
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name=ai-meow-outfit

echo ""
echo "✅ Deploy complete!"
echo "   https://c3c21dc7.ai-meow-outfit.pages.dev"
