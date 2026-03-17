import { Plugin, WorkspaceLeaf } from "obsidian";

export default class MruCloseFocusPlugin extends Plugin {
	private history: WorkspaceLeaf[] = [];
	private lastActiveLeaf: WorkspaceLeaf | null = null;
	private restoreInProgress = false;
	private restoreTimer: number | null = null;

	async onload() {
		// Build an initial MRU seed from the current active leaf.
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

		// Only relevant when focus changed away from a previously active leaf.
		if (!previousLeaf || previousLeaf === newLeaf) return;

		// Delay slightly so Obsidian can finish removing the closed leaf.
		if (this.restoreTimer !== null) {
			window.clearTimeout(this.restoreTimer);
		}

		this.restoreTimer = window.setTimeout(() => {
			this.restoreTimer = null;

			// If the previously active leaf no longer exists, it was likely closed.
			if (!this.leafExists(previousLeaf)) {
				const fallback = this.findFallbackLeaf(previousLeaf, newLeaf);
				if (!fallback) return;

				this.restoreInProgress = true;
				try {
					this.app.workspace.setActiveLeaf(fallback, { focus: true });
					this.lastActiveLeaf = fallback;
					this.rememberLeaf(fallback);
				} finally {
					// Release the guard on the next tick to avoid event recursion.
					window.setTimeout(() => {
						this.restoreInProgress = false;
					}, 0);
				}
			}
		}, 0);
	}

	private rememberLeaf(leaf: WorkspaceLeaf) {
		if (!this.isUsableLeaf(leaf)) return;

		this.history = this.history.filter((item) => item !== leaf);
		this.history.unshift(leaf);

		// Keep it tiny and simple.
		if (this.history.length > 50) {
			this.history.length = 50;
		}
	}

	private findFallbackLeaf(
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
		// Ignore leaves that are not part of normal navigation.
		const view = leaf.view;
		if (!view) return false;

		// `navigation` is how Obsidian marks views meant for navigation.
		// This helps avoid weird focus jumps to utility/sidebar leaves.
		return view.navigation === true;
	}
}