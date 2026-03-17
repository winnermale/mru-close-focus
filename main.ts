import { Plugin, WorkspaceLeaf } from "obsidian";

module.exports = class MruCloseFocusPlugin extends Plugin {
	private history: WorkspaceLeaf[] = [];
	private activeLeaf: WorkspaceLeaf | null = null;
	private restoreInProgress = false;
	private restoreTimer: number | null = null;

	async onload() {
		const active = this.app.workspace.getMostRecentLeaf();
		if (active && this.isUsableLeaf(active)) {
			this.activeLeaf = active;
			this.touchHistory(active);
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

		const previousLeaf = this.activeLeaf;

		if (!previousLeaf) {
			this.activeLeaf = newLeaf;
			if (newLeaf && this.isUsableLeaf(newLeaf)) {
				this.touchHistory(newLeaf);
			}
			return;
		}

		if (newLeaf === previousLeaf) return;

		if (this.restoreTimer !== null) {
			window.clearTimeout(this.restoreTimer);
		}

		this.restoreTimer = window.setTimeout(() => {
			this.restoreTimer = null;

			const previousWasClosed = !this.leafExists(previousLeaf);

			if (previousWasClosed) {
				const fallback = this.findMostRecentSurvivingLeaf(previousLeaf);

				if (!fallback) {
					this.activeLeaf = newLeaf;
					return;
				}

				this.restoreInProgress = true;
				try {
					if (fallback !== newLeaf) {
						this.app.workspace.setActiveLeaf(fallback, { focus: true });
					}
					this.activeLeaf = fallback;
					this.touchHistory(fallback);
				} finally {
					window.setTimeout(() => {
						this.restoreInProgress = false;
					}, 0);
				}

				return;
			}

			this.activeLeaf = newLeaf;
			if (newLeaf && this.isUsableLeaf(newLeaf)) {
				this.touchHistory(newLeaf);
			}
		}, 20);
	}

	private touchHistory(leaf: WorkspaceLeaf) {
		if (!this.isUsableLeaf(leaf)) return;

		this.history = this.history.filter((item) => item !== leaf);
		this.history.unshift(leaf);

		if (this.history.length > 100) {
			this.history.length = 100;
		}
	}

	private findMostRecentSurvivingLeaf(closedLeaf: WorkspaceLeaf): WorkspaceLeaf | null {
		for (const leaf of this.history) {
			if (leaf === closedLeaf) continue;
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
};