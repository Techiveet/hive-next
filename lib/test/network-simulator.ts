// lib/test/network-simulator.ts
"use client";

export class NetworkSimulator {
  private static instance: NetworkSimulator;
  private isSimulating = false;
  private originalFetch: typeof fetch;
  
  private constructor() {
    this.originalFetch = window.fetch;
  }
  
  static getInstance() {
    if (!NetworkSimulator.instance) {
      NetworkSimulator.instance = new NetworkSimulator();
    }
    return NetworkSimulator.instance;
  }
  
  simulateOffline(durationMs = 10000) {
    if (this.isSimulating) return;
    
    this.isSimulating = true;
    console.log(`🚫 Simulating offline mode for ${durationMs}ms`);
    
    // Override fetch to simulate offline
    window.fetch = async (...args) => {
      const url = args[0].toString();
      
      // Allow health checks to fail gracefully
      if (url.includes("/api/health")) {
        return Promise.reject(new Error("Network error - simulated offline"));
      }
      
      // Queue API calls
      if (url.includes("/api/")) {
        return new Response(
          JSON.stringify({ 
            queued: true, 
            simulated: true,
            message: "Offline simulation - request queued" 
          }),
          { 
            status: 202,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      
      // For static assets, try cache
      return this.originalFetch(...args).catch(() => {
        return new Response("Offline simulation", { status: 503 });
      });
    };
    
    // Reset after duration
    setTimeout(() => {
      this.restore();
      console.log("✅ Network simulation ended");
    }, durationMs);
  }
  
  simulateSlowConnection(delayMs = 2000) {
    if (this.isSimulating) return;
    
    this.isSimulating = true;
    console.log(`🐢 Simulating slow connection (${delayMs}ms delay)`);
    
    window.fetch = async (...args) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return this.originalFetch(...args);
    };
    
    // Auto-restore after 30 seconds
    setTimeout(() => this.restore(), 30000);
  }
  
  simulateServerError(errorRate = 0.3) {
    if (this.isSimulating) return;
    
    this.isSimulating = true;
    console.log(`⚠️ Simulating server errors (${errorRate * 100}% failure rate)`);
    
    window.fetch = async (...args) => {
      const shouldError = Math.random() < errorRate;
      const url = args[0].toString();
      
      if (shouldError && url.includes("/api/")) {
        return new Response(
          JSON.stringify({ 
            error: "Simulated server error",
            code: "SIMULATED_FAILURE"
          }),
          { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      
      return this.originalFetch(...args);
    };
    
    setTimeout(() => this.restore(), 15000);
  }
  
  restore() {
    if (!this.isSimulating) return;
    
    window.fetch = this.originalFetch;
    this.isSimulating = false;
    console.log("🔄 Network restored to normal");
  }
}

// React hook for network simulation
export function useNetworkSimulator() {
  const simulator = NetworkSimulator.getInstance();
  
  return {
    goOffline: (durationMs?: number) => simulator.simulateOffline(durationMs),
    goSlow: (delayMs?: number) => simulator.simulateSlowConnection(delayMs),
    causeErrors: (errorRate?: number) => simulator.simulateServerError(errorRate),
    restore: () => simulator.restore(),
    isSimulating: simulator["isSimulating"],
  };
}