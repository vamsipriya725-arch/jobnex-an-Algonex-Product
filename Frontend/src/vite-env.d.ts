/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly [key: string]: string | undefined;
    readonly NODE_ENV?: "development" | "production" | "test";
    readonly BACKEND_URL?: string;
    readonly VITE_API_URL?: string;
  }
  interface Process {
    readonly env: ProcessEnv;
  }
}

declare const process: NodeJS.Process;

