import * as fs from "fs";
import * as path from "path";
import { FLUTTER_CREATE_PROJECT_TRIGGER_FILE, isWin } from "../constants";
import { flatMapAsync } from "../utils";
import { sortBy } from "./array";

export function fsPath(uri: { fsPath: string } | string) {
	// tslint:disable-next-line:disallow-fspath
	return forceWindowsDriveLetterToUppercase(typeof uri === "string" ? uri : uri.fsPath);
}

export function forceWindowsDriveLetterToUppercase(p: string): string {
	if (p && isWin && path.isAbsolute(p) && p.charAt(0) === p.charAt(0).toLowerCase())
		p = p.substr(0, 1).toUpperCase() + p.substr(1);
	return p;
}

export function isWithinPath(file: string, folder: string) {
	const relative = path.relative(folder, file);
	return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function getChildFolders(parent: string, options?: { allowBin?: boolean, allowCache?: boolean }): Promise<string[]> {
	if (!fs.existsSync(parent))
		return [];
	const files = await readDirAsync(parent);

	return files.filter((f) => f.isDirectory())
		.filter((f) => f.name !== "bin" || (options && options.allowBin)) // Don't look in bin folders
		.filter((f) => f.name !== "cache" || (options && options.allowCache)) // Don't look in cache folders
		.map((item) => path.join(parent, item.name));
}

function readDirAsync(folder: string): Promise<fs.Dirent[]> {
	return new Promise<fs.Dirent[]>((resolve, reject) => {
		return fs.readdir(folder,
			{ withFileTypes: true },
			(err, files) => {
				if (err)
					reject(err);
				else
					resolve(files);
			},
		);
	});
}

export function hasPackagesFile(folder: string): boolean {
	return fs.existsSync(path.join(folder, ".packages"));
}

export function hasPubspec(folder: string): boolean {
	return fs.existsSync(path.join(folder, "pubspec.yaml"));
}

export function hasCreateTriggerFile(folder: string): boolean {
	return fs.existsSync(path.join(folder, FLUTTER_CREATE_PROJECT_TRIGGER_FILE));
}

export function isFlutterRepo(folder: string): boolean {
	return fs.existsSync(path.join(folder, "bin/flutter")) && fs.existsSync(path.join(folder, "bin/cache/dart-sdk"));
}

// Walks a few levels down and returns all folders that look like project
// folders, such as:
// - have a pubspec.yaml
// - have a project create trigger file
// - are the Flutter repo root
export async function findProjectFolders(roots: string[], options: { sort?: boolean, requirePubspec?: boolean } = {}): Promise<string[]> {
	const level2Folders = await flatMapAsync(roots, getChildFolders);
	const level3Folders = await flatMapAsync(level2Folders, getChildFolders);
	const allPossibleFolders = roots.concat(level2Folders).concat(level3Folders);

	const projectFolders = allPossibleFolders.filter((f) => {
		return options && options.requirePubspec
			? hasPubspec(f)
			: hasPubspec(f) || hasCreateTriggerFile(f) || isFlutterRepo(f);
	});
	return options && options.sort
		? sortBy(projectFolders, (p) => p.toLowerCase())
		: projectFolders;
}

export function tryDeleteFile(filePath: string) {
	if (fs.existsSync(filePath)) {
		try {
			fs.unlinkSync(filePath);
		} catch {
			console.warn(`Failed to delete file $path.`);
		}
	}
}

export function getRandomInt(min: number, max: number) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

export function mkDirRecursive(folder: string) {
	const parent = path.dirname(folder);
	if (!fs.existsSync(parent))
		mkDirRecursive(parent);
	if (!fs.existsSync(folder))
		fs.mkdirSync(folder);
}

export function areSameFolder(folder1: string, folder2: string) {
	// Trim any trailing path separators of either direction.
	folder1 = folder1.replace(/[\\/]+$/, "");
	folder2 = folder2.replace(/[\\/]+$/, "");

	return folder1 === folder2;
}
