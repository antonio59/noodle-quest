import ts from 'typescript';
import fs from 'node:fs';

/**
 * Extract the value of a top-level `const` from a TS/TSX source file without
 * importing it. The initializer is transpiled to JS and evaluated, so plain
 * data literals work even when they sit inside React components. Identifiers
 * referenced inside the literal (helper functions, imported components) can be
 * supplied via `scope`.
 */
export function extractConst<T>(filePath: string, name: string, scope: Record<string, unknown> = {}): T {
  const source = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  let init: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (init) return;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
          init = decl.initializer;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!init) throw new Error(`const "${name}" not found in ${filePath}`);

  const keys = Object.keys(scope);
  const raw = init.getText(sf).trim();
  // Data constants are already plain JS literals — evaluate directly. If the
  // initializer ever uses TS-only syntax, fall back to transpiling first.
  const evalExpr = (expr: string) =>
    new Function(...keys, `return (${expr});`)(...keys.map(k => scope[k])) as T;
  try {
    return evalExpr(raw);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    const { outputText } = ts.transpileModule(raw, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
    });
    return evalExpr(outputText.trim().replace(/;+$/, ''));
  }
}
