import * as vscode from 'vscode';
import { DisplayClient } from './display-client';

let statusBarItem: vscode.StatusBarItem;
let pollTimer: ReturnType<typeof setInterval> | undefined;
const client = new DisplayClient();

async function refreshDeckStatus(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    statusBarItem.text = '$(layers) Agent Deck';
    statusBarItem.tooltip = 'Open a folder to see the bound deck';
    statusBarItem.show();
    return;
  }

  const result = await client.resolveDisplay(workspaceRoot);
  statusBarItem.text = result.displayLine;
  statusBarItem.tooltip = result.tooltip;
  statusBarItem.show();
}

function restartPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = setInterval(() => {
    void refreshDeckStatus();
  }, client.getPollIntervalMs());
}

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.name = 'Agent Deck Bound Deck';
  statusBarItem.command = 'agentDeck.openDashboard';

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand('agentDeck.refreshDeckStatus', () => refreshDeckStatus()),
    vscode.commands.registerCommand('agentDeck.openDashboard', () => client.openDashboard()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => refreshDeckStatus()),
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        void refreshDeckStatus();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('agentDeck')) {
        restartPolling();
        void refreshDeckStatus();
      }
    }),
  );

  void refreshDeckStatus();
  restartPolling();
}

export function deactivate(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
}
