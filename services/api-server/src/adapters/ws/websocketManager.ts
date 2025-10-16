export class WebSocketManager {
  private dexes: any[];
  
  constructor(dexes: any[]) {
    this.dexes = dexes;
  }
  
  async connect() {
    console.log("WebSocket Manager connected");
  }
}
