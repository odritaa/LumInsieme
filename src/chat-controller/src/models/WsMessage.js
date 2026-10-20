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

  static broadcast(message) {
    return new WsMessage("message", message.toJSON());
  }

  toJSON() {
    return { type: this.type, payload: this.payload };
  }
}
