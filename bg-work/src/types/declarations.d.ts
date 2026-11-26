declare module 'onnxruntime-web' {
  export const env: {
    wasm: {
      numThreads: number;
      proxy?: boolean;
      wasmPaths?: Record<string, string>;
    };
    debug?: boolean;
    logLevel?: string;
  };
  export const InferenceSession: any;
  export const Tensor: any;
}

declare module 'onnxruntime-web/webgpu' {
  const ortWebGpu: any;
  export default ortWebGpu;
}

