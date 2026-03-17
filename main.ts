import { Plugin, WorkspaceLeaf } from "obsidian";

export default class MruCloseFocusPlugin extends Plugin {
	private history: WorkspaceLeaf[] = [];
	private lastActiveLeaf: WorkspaceLeaf | null = null;
	private restoreInProgress = false;
	private restoreTimer: number | null = null;

	async onload() {
		const active = this.app.workspace.getMostRecentLeaf();
		if (active) {
			this.lastActiveLeaf = active;
			this.rememberLeaf(active);
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
		this.lastActiveLeaf = newLeaf;

		if (newLeaf) {
			this.rememberLeaf(newLeaf);
		}

		if (!previousLeaf || previousLeaf === newLeaf) return;

		if (this.restoreTimer !== null) {
			window.clearTimeout(this.restoreTimer);
		}

		this.restoreTimer = window.setTimeout(() => {
			this.restoreTimer = null;

			if (!this.leafExists(previousLeaf)) {
				const fallback = this.findFallbackLeaf(previousLeaf, newLeaf);
				if (!fallback) return;

				this.restoreInProgress = true;
				try {
					this.app.workspace.setActiveLeaf(fallback, { focus: true });
					this.lastActiveLeaf = fallback;
					this.rememberLeaf(fallback);
				} finally {
					window.setTimeout(() => {
						this.restoreInProgress = false;
					}, 0);
				}
			}
		}, 25);
	}

	private rememberLeaf(leaf: WorkspaceLeaf) {
		if (!this.isUsableLeaf(leaf)) return;

		this.history = this.history.filter((item) => item !== leaf);
		this.history.unshift(leaf);

		if (this.history.length > 100) {
			this.history.length = 100;
		}
	}

	private findFallbackLeaf(
		closedLeaf: WorkspaceLeaf,
		currentLeaf: WorkspaceLeaf | null
	): WorkspaceLeaf | null {
		const closedType = this.getLeafType(closedLeaf);

		for (const leaf of this.history) {
			if (!this.isCandidateLeaf(leaf, closedLeaf, currentLeaf)) continue;
			if (this.getLeafType(leaf) === closedType) return leaf;
		}

		for (const leaf of this.history) {
			if (!this.isCandidateLeaf(leaf, closedLeaf, currentLeaf)) continue;
			return leaf;
		}

		return null;
	}

	private isCandidateLeaf(
		leaf: WorkspaceLeaf,
		closedLeaf: WorkspaceLeaf,
		currentLeaf: WorkspaceLeaf | null
	): boolean {
		if (leaf === closedLeaf) return false;
		if (leaf === currentLeaf) return false;
		if (!this.leafExists(leaf)) return false;
		if (!this.isUsableLeaf(leaf)) return false;
		return true;
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

	private getLeafType(leaf: WorkspaceLeaf): string {
		return leaf.view?.getViewType?.() ?? "";
	}
}