export default class WsMessage {
  constructor(type, payload) {
    this.type = type;
    this.payload = payload;
  }

  static incoming(content) {
    return { content };
  }

  static history(messages) {
    return new WsMessage("history", messages);
  }

  static broadcast(username, content, timestamp) {
    return new WsMessage("message", { username, content, timestamp });
  }

  toJSON() {
    return { type: this.type, payload: this.payload };
  }
}
