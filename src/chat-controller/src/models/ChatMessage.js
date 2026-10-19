export default class ChatMessage {
  constructor(username, content, timestamp = Date.now()) {
    this.username = username;
    this.content = content;
    this.timestamp = timestamp;
  }

  toJSON() {
    return {
      username: this.username,
      content: this.content,
      timestamp: this.timestamp,
    };
  }

  static fromJSON(obj) {
    return new ChatMessage(obj.username, obj.content, obj.timestamp);
  }
}
