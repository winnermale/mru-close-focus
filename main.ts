import { Plugin, WorkspaceLeaf } from "obsidian";

export default class MruCloseFocusPlugin extends Plugin {
	private history: WorkspaceLeaf[] = [];
	private lastActiveLeaf: WorkspaceLeaf | null = null;
	private restoreInProgress = false;
	private restoreTimer: number | null = null;

	async onload() {
		const active = this.app.workspace.getMostRecentLeaf();
		if (active && this.isUsableLeaf(active)) {
			this.lastActiveLeaf = active;
			this.pushToHistory(active);
		}

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				this.onActiveLeafChange(leaf);
			})
		);
	}

	onunload() {
		if (this.restoreTimer !== null) {
			window.clearTimeout(this.restoreTimer);
			this.restoreTimer = null;
		}
	}

	private onActiveLeafChange(newLeaf: WorkspaceLeaf | null) {
		if (this.restoreInProgress) return;

		const previousLeaf = this.lastActiveLeaf;

		if (!previousLeaf && newLeaf && this.isUsableLeaf(newLeaf)) {
			this.lastActiveLeaf = newLeaf;
			this.pushToHistory(newLeaf);
			return;
		}

		if (!previousLeaf || previousLeaf === newLeaf) {
			this.lastActiveLeaf = newLeaf;
			return;
		}

		if (this.restoreTimer !== null) {
			window.clearTimeout(this.restoreTimer);
		}

		this.restoreTimer = window.setTimeout(() => {
			this.restoreTimer = null;

			const previousWasClosed = !this.leafExists(previousLeaf);

			if (previousWasClosed) {
				const fallback = this.findPreviousSurvivingLeaf(previousLeaf, newLeaf);
				if (!fallback) {
					this.lastActiveLeaf = newLeaf;
					return;
				}

				this.restoreInProgress = true;
				try {
					this.app.workspace.setActiveLeaf(fallback, { focus: true });
					this.lastActiveLeaf = fallback;
				} finally {
					window.setTimeout(() => {
						this.restoreInProgress = false;
					}, 0);
				}

				return;
			}

			if (newLeaf && this.isUsableLeaf(newLeaf)) {
				this.pushToHistory(newLeaf);
			}
			this.lastActiveLeaf = newLeaf;
		}, 30);
	}

	private pushToHistory(leaf: WorkspaceLeaf) {
		this.history = this.history.filter((item) => item !== leaf);
		this.history.unshift(leaf);

		if (this.history.length > 100) {
			this.history.length = 100;
		}
	}

	private findPreviousSurvivingLeaf(
		closedLeaf: WorkspaceLeaf,
		currentLeaf: WorkspaceLeaf | null
	): WorkspaceLeaf | null {
		for (const leaf of this.history) {
			if (leaf === closedLeaf) continue;
			if (leaf === currentLeaf) continue;
			if (!this.leafExists(leaf)) continue;
			if (!this.isUsableLeaf(leaf)) continue;
			return leaf;
		}

		return null;
	}

	private leafExists(target: WorkspaceLeaf): boolean {
		let exists = false;

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf === target) exists = true;
		});

		return exists;
	}

	private isUsableLeaf(leaf: WorkspaceLeaf): boolean {
		const view = leaf.view;
		if (!view) return false;
		return view.navigation === true;
	}
}