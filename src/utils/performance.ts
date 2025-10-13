// create a simple performance logging class
// It should have a start, log, and end methods
// each time log is called i should log the time since start and since last log
// with an optinal message
// user the performance api

// simple usage example:
// const per = new PerformanceLogger();
// per.mark('Starting setup phase');
// // .... (Code runs)
// per.log('Finished setup');
// // .... (Code runs)
// per.elapsed('Final check on elapsed time before closing');
// per.end('Function complete');
export class PerformanceLogger {
  private startTime: number;
  private zoneStart: number; // New: To track the start of the current "elapsed zone"
  private lastLogTime: number;

  constructor() {
    this.startTime = performance.now();
    this.zoneStart = this.startTime; // Start zone with total time
    this.lastLogTime = this.startTime;
  }

  mark(msg?: string) {
    this.zoneStart = performance.now(); // Reset the zone timer
    this.lastLogTime = this.zoneStart; // Also reset the step timer to the zone start
    if (msg) {
      console.log(`[PerformanceLogger] New Zone Started: ${msg}`);
    }
  }

  log(message: string) {
    const now = performance.now();
    const timeSinceStart = now - this.startTime;
    const timeSinceLastLog = now - this.lastLogTime;
    // Reset step timer
    this.lastLogTime = now; 
    console.log(`[PerformanceLogger] ${message} - Step Time: ${timeSinceLastLog.toFixed(2)} ms, Total Time: ${timeSinceStart.toFixed(2)} ms`);
  }

  elapsed(msg: string) {
    const now = performance.now();
    const timeSinceZoneStart = now - this.zoneStart;
    // Note: this method does NOT update this.lastLogTime
    console.log(`[PerformanceLogger] ZONE ELAPSED: ${msg} - Zone Time: ${timeSinceZoneStart.toFixed(2)} ms`);
  }

  end(finalMessage: string) {
    const now = performance.now();
    const totalTime = now - this.startTime;
    
    // Use console.info for an emphatic finish
    console.info(`\n--- [PerformanceLogger END] ---`);
    console.info(`[PerformanceLogger] ${finalMessage} - Total Process Time: ${totalTime.toFixed(2)} ms`);
    console.info(`-------------------------------\n`);
  }
}