import * as vs from "vscode";
import { nullLogger } from "../../shared/logging";
import { fsPath } from "../../shared/utils/fs";
import { toRange } from "../../shared/vscode/utils";
import { DasAnalyzer, getCodeOffset, getElementName, getSymbolKindForElementKind } from "../analysis/analyzer_das";
import { findNearestOutlineNode } from "../utils/vscode/outline";

export class DartCallHierarchyProvider implements vs.CallHierarchyProvider {
	constructor(readonly analyzer: DasAnalyzer) { }

	public async prepareCallHierarchy(document: vs.TextDocument, position: vs.Position, token: vs.CancellationToken): Promise<vs.CallHierarchyItem | undefined> {
		const outlineNode = findNearestOutlineNode(this.analyzer.fileTracker, document, position, false, ["FUNCTION", "METHOD", "GETTER", "SETTER"]);
		if (!outlineNode?.element?.location)
			return undefined;

		return new vs.CallHierarchyItem(
			getSymbolKindForElementKind(nullLogger, outlineNode?.element?.kind),
			getElementName(outlineNode.element),
			outlineNode.element.parameters || "",
			vs.Uri.file(outlineNode.element.location.file),
			getCodeOffset(document, outlineNode),
			toRange(document, outlineNode.element.location.offset, outlineNode.element.location.length),
		);
	}

	public async provideCallHierarchyIncomingCalls(item: vs.CallHierarchyItem, token: vs.CancellationToken): Promise<vs.CallHierarchyIncomingCall[] | undefined> {
		const doc = await vs.workspace.openTextDocument(item.uri);
		const offset = doc.offsetAt(item.selectionRange.start);
		const resp = await this.analyzer.client.searchFindElementReferencesResults({
			file: fsPath(item.uri),
			includePotential: true,
			offset,
		});

		if (token && token.isCancellationRequested)
			return;

		return resp.results.map((result) => {
			return new vs.CallHierarchyIncomingCall(
				new vs.CallHierarchyItem(
					getSymbolKindForSearchResultKind(nullLogger, result.kind),
					getElementName(outlineNode.element),
					outlineNode.element.parameters || "",
					vs.Uri.file(outlineNode.element.location.file),
					getCodeOffset(document, outlineNode),
					toRange(document, outlineNode.element.location.offset, outlineNode.element.location.length),
				),
				[],
			);
		});
	}

	public async provideCallHierarchyOutgoingCalls(item: vs.CallHierarchyItem, token: vs.CancellationToken): Promise<vs.CallHierarchyOutgoingCall[]> {
		return [];
	}

	// public async provideImplementation(document: vs.TextDocument, position: vs.Position, token: vs.CancellationToken): Promise<vs.Definition | undefined> {
	// 	// Try to use the Outline data to snap our location to a node.
	// 	// For example in:
	// 	//
	// 	//     void b();
	// 	//
	// 	// The search.getTypeHierarchy call will only work over "b" but by using outline we
	// 	// can support the whole "void b();".
	// 	const outlineNode = findNearestOutlineNode(this.analyzer.fileTracker, document, position, true);
	// 	const offset = outlineNode && outlineNode.element && outlineNode.element.location
	// 		? outlineNode.element.location.offset
	// 		: document.offsetAt(position);

	// 	const hierarchy = await this.analyzer.client.searchGetTypeHierarchy({
	// 		file: fsPath(document.uri),
	// 		offset,
	// 	});

	// 	if (token.isCancellationRequested || !hierarchy || !hierarchy.hierarchyItems || !hierarchy.hierarchyItems.length || hierarchy.hierarchyItems.length === 1)
	// 		return;

	// 	// Find the element we started with.
	// 	const currentItem = hierarchy.hierarchyItems.find((h) => {
	// 		const elm = h.memberElement || h.classElement;
	// 		return elm.location && elm.location.offset <= offset && elm.location.offset + elm.location.length >= offset;
	// 	});

	// }
}
