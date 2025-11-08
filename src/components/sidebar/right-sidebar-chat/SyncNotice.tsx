import React from "react";

interface SyncNoticeProps {
	message?: string;
}

export const SyncNotice: React.FC<
	SyncNoticeProps
> = ({
	message = "AI changes applied. Waiting for canvas to sync…",
}) => (
	<div className="px-3 py-2 text-xs text-muted-foreground border-b border-border bg-muted/40">
		{message}
	</div>
);


