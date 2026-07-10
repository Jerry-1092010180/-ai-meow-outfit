/**
 * API 基础层 — 包装 fetch 请求
 * Mock 模式下模拟网络延迟，返回本地数据
 */

import { FEATURE_FLAGS } from '@/config';

const BASE_URL = '/api';
const MOCK_DELAY_MS = 400; // 模拟网络延迟

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/** 模拟延迟 */
function delay(ms: number = MOCK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 通用 GET 请求 */
export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  if (FEATURE_FLAGS.useMock) {
    await delay();
    console.log(`[Mock API] GET ${endpoint}`);
  }
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { data, success: true };
  } catch (error) {
    return {
      data: null as T,
      success: false,
      message: error instanceof Error ? error.message : '请求失败',
    };
  }
}

/** 通用 POST 请求 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  if (FEATURE_FLAGS.useMock) {
    await delay();
    console.log(`[Mock API] POST ${endpoint}`, body);
  }
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { data, success: true };
  } catch (error) {
    return {
      data: null as T,
      success: false,
      message: error instanceof Error ? error.message : '请求失败',
    };
  }
}
