export interface NssConversationMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "tool";
  readonly content: string;
  readonly createdAt: string;
  readonly responseId?: string;
}

export interface NssConversationThread {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly NssConversationMessage[];
}
