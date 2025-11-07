declare module 'liquidjs' {
  interface LiquidOptions {
    extname?: string;
    cache?: boolean;
    // Add more options if you use them
  }

  class Liquid {
    constructor(options?: LiquidOptions);
    parseAndRender(template: string, ctx: Record<string, any>): Promise<string>;
    // Extend with other methods (e.g., renderSync) if needed
  }

  export { Liquid };
}