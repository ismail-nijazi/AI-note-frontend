import { WS_ENABLED, WS_URL } from "@/config/api";

export type OutboundMessage =
	| { type: "join"; noteId: string }
	| {
			type: "note:update";
			noteId: string;
			content?: unknown;
			title?: string;
			collectionId?: string;
			version: number;
	  };

export type InboundMessage =
	| {
			type: "note:ack";
			noteId: string;
			version: number;
	  }
	| {
			type: "note:conflict";
			noteId: string;
			currentVersion: number;
	  }
	| {
			type: "note:updated";
			noteId: string;
			content: unknown;
			version: number;
	  }
	| {
			type: "note:error";
			noteId: string;
			code: string;
	  }
	| { type: "error"; message: string };

type Listener = (msg: InboundMessage) => void;

class WebSocketService {
	private ws: WebSocket | null = null;
	private listeners = new Set<Listener>();
	private pending: OutboundMessage[] = [];
	private reconnectAttempts = 0;
	private joinedNoteId: string | null = null;

	connect() {
		if (!WS_ENABLED || this.ws) return;
		try {
			const ws = new WebSocket(WS_URL);
			this.ws = ws;
			ws.onopen = () => {
				this.reconnectAttempts = 0;
				if (this.joinedNoteId) {
					this.send({
						type: "join",
						noteId: this.joinedNoteId,
					});
				}
				this.flush();
			};
			ws.onmessage = (ev) => {
				try {
					const data = JSON.parse(
						ev.data
					) as InboundMessage;
					for (const l of this
						.listeners)
						l(data);
				} catch {}
			};
			ws.onclose = () => {
				this.ws = null;
				this.scheduleReconnect();
			};
			ws.onerror = () => {
				try {
					ws.close();
				} catch {}
			};
		} catch {
			this.scheduleReconnect();
		}
	}

	private scheduleReconnect() {
		if (!WS_ENABLED) return;
		const delay = Math.min(
			1000 *
				Math.pow(
					2,
					this.reconnectAttempts++
				),
			15000
		);
		setTimeout(() => this.connect(), delay);
	}

	joinNote(noteId: string) {
		this.joinedNoteId = noteId;
		this.send({ type: "join", noteId });
	}

	on(listener: Listener) {
		this.listeners.add(listener);
		return () =>
			this.listeners.delete(listener);
	}

	send(msg: OutboundMessage) {
		if (!WS_ENABLED) return;
		if (
			this.ws &&
			this.ws.readyState === WebSocket.OPEN
		) {
			try {
				this.ws.send(JSON.stringify(msg));
			} catch {
				this.pending.push(msg);
			}
		} else {
			this.pending.push(msg);
			this.connect();
		}
	}

	private flush() {
		if (
			!this.ws ||
			this.ws.readyState !== WebSocket.OPEN
		)
			return;
		while (this.pending.length) {
			const m = this.pending.shift();
			if (m) this.send(m);
		}
	}
}

export const socketService =
	new WebSocketService();
