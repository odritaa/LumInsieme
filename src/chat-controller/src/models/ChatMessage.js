export default class ChatMessage {
  constructor(userId, username, content, timestamp = Date.now()) {
    this.userId = userId;
    this.username = username;
    this.content = content;
    this.timestamp = timestamp;
  }

  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      content: this.content,
      timestamp: this.timestamp,
    };
  }

  static fromJSON(obj) {
    return new ChatMessage(obj.userId ?? null, obj.username, obj.content, obj.timestamp);
  }
}
