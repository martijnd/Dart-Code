import * as path from "path";
import * as vs from "vscode";
import { DART_IS_CAPTURING_LOGS_CONTEXT } from "../../shared/constants";
import { LogCategory } from "../../shared/enums";
import { captureLogs, EmittingLogger } from "../../shared/logging";
import { PromiseCompleter } from "../../shared/utils";
import { forceWindowsDriveLetterToUppercase, fsPath } from "../../shared/utils/fs";
import { config } from "../config";
import { createFolderForFile } from "../utils";
import { getLogHeader, userSelectableLogCategories } from "../utils/log";

export let isLogging = false;

export class LoggingCommands implements vs.Disposable {
	private disposables: vs.Disposable[] = [];
	private currentLogCompleter: PromiseCompleter<void> | undefined;

	constructor(private readonly logger: EmittingLogger, private extensionLogPath: string) {
		this.disposables.push(
			vs.commands.registerCommand("dart.startLogging", this.startLogging, this),
			vs.commands.registerCommand("dart.stopLogging", this.stopLogging, this),
		);
	}

	private async startLogging(): Promise<string | undefined> {
		const logFilename = path.join(forceWindowsDriveLetterToUppercase(this.extensionLogPath), this.generateFilename());
		const logUri = vs.Uri.file(logFilename);
		createFolderForFile(logFilename);

		const selectedLogCategories = await vs.window.showQuickPick(
			Object.keys(userSelectableLogCategories).map((k) => ({
				label: k,
				logCategory: userSelectableLogCategories[k],
				picked: true,
			})),
			{
				canPickMany: true,
				placeHolder: "Select which categories to include in the log",
			},
		);
		if (!selectedLogCategories || !selectedLogCategories.length)
			return;

		const allLoggedCategories = [LogCategory.General].concat(selectedLogCategories.map((s) => s.logCategory));

		const logger = captureLogs(this.logger, fsPath(logUri), getLogHeader(), config.maxLogLineLength, allLoggedCategories);
		isLogging = true;
		this.disposables.push(logger);
		vs.commands.executeCommand("setContext", DART_IS_CAPTURING_LOGS_CONTEXT, true);
		const completer = new PromiseCompleter<void>();
		this.currentLogCompleter = completer;

		await vs.window.withProgress(
			{
				cancellable: true,
				location: vs.ProgressLocation.Notification,
				title: `Dart and Flutter logs are being captured. Reproduce your issue then click Cancel.`,
			},
			(_, token) => {
				token.onCancellationRequested(() => completer.resolve());
				return completer.promise;
			},
		);

		isLogging = false;
		await logger.dispose();

		const doc = await vs.workspace.openTextDocument(logUri);
		await vs.window.showTextDocument(doc);

		return logFilename;
	}

	private async stopLogging(): Promise<void> {
		if (this.currentLogCompleter)
			this.currentLogCompleter.resolve();
	}

	private generateFilename(): string {
		const pad = (s: string | number) => `0${s.toString()}`.slice(-2);
		const now = new Date();
		const formattedDate = `${now.getFullYear()}-${pad(now.getMonth())}-${pad(now.getDay())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
		return `Dart-Code-Log-${formattedDate}.txt`;
	}

	public dispose(): any {
		for (const command of this.disposables)
			command.dispose();
	}
}
