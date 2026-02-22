type TelemetryEvent =
  | "ai_message_sent"
  | "ai_stream_completed"
  | "ai_stream_error"
  | "ai_tool_result"
  | "ai_undo_attempt"
  | "ai_undo_success"
  | "ai_undo_failed";

export const trackAIEvent = (
  event: TelemetryEvent,
  payload: Record<string, unknown> = {},
) => {
  console.log(
    JSON.stringify({
      scope: "ai_telemetry",
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
};
