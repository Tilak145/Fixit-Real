// Type-checks the app, then reports text React Native cannot render. A string
// or number outside <Text> crashes the Android app ("Text strings must be
// rendered within a <Text> component"), while the web Preview only logs it.
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const host = {
  getCanonicalFileName: (name) => name,
  getCurrentDirectory: () => root,
  getNewLine: () => '\n',
};
const config = ts.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.json'), { noEmit: true }, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(diagnostic) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext([diagnostic], host));
    process.exit(2);
  },
});
const program = ts.createProgram({ rootNames: config.fileNames, options: config.options, projectReferences: config.projectReferences });
const checker = program.getTypeChecker();
const diagnostics = [...ts.getPreEmitDiagnostics(program)];

// React Native and template components that render a View or Pressable around
// their children, so text inside them needs its own <Text>.
const NATIVE_VIEWS = new Set(['View', 'ScrollView', 'Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'KeyboardAvoidingView', 'SafeAreaView', 'ImageBackground']);
const TEMPLATE_VIEWS = new Set([
  'Alert', 'Badge', 'Button', 'Card', 'CardContent', 'CardFooter', 'CardHeader', 'Empty', 'EmptyContent', 'EmptyHeader', 'EmptyMedia',
  'Field', 'FieldContent', 'FieldGroup', 'InputGroup', 'InputGroupAddon', 'Item', 'ItemActions', 'ItemContent', 'ItemFooter', 'ItemGroup',
  'ItemHeader', 'ItemMedia', 'Screen', 'Section', 'TabsContent', 'TabsList', 'TabsTrigger', 'Toggle', 'ToggleGroupItem',
]);

function declaration(node) {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declared = symbol?.declarations?.[0];
  if (!declared) return null;
  // `const SafeAreaView = withUniwind(NativeSafeAreaView)` styles the wrapped component.
  if (ts.isVariableDeclaration(declared) && declared.initializer && ts.isCallExpression(declared.initializer)
    && declared.initializer.expression.getText() === 'withUniwind' && declared.initializer.arguments[0]) {
    return declaration(declared.initializer.arguments[0]);
  }
  return { name: symbol.name, file: declared.getSourceFile().fileName };
}

function component(element) {
  const tag = ts.isJsxElement(element) ? element.openingElement.tagName : null;
  const found = tag && declaration(ts.isPropertyAccessExpression(tag) ? tag.name : tag);
  if (!found) return null;
  const file = found.file.split(path.sep).join('/');
  if (/\/node_modules\/(react-native|react-native-safe-area-context|react-native-gesture-handler)\//.test(file)) return { name: found.name, view: NATIVE_VIEWS.has(found.name) };
  if (file.startsWith(root.split(path.sep).join('/') + '/components/')) return { name: found.name, view: TEMPLATE_VIEWS.has(found.name) };
  return null;
}

const rendersView = (element) => component(element)?.view === true;
const isText = (element) => component(element)?.name === 'Text';

// Whether a value of this type renders as text: a string or number, or only a
// falsy one when `onlyFalsy` (what `value && <X />` leaves behind).
// Inside <Text> only a number shows (as "0"); an empty string renders nothing.
function rendersText(type, onlyFalsy, strings = true) {
  if (type.isUnion()) return type.types.some((part) => rendersText(part, onlyFalsy, strings));
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
  if (type.isStringLiteral()) return strings && (!onlyFalsy || type.value === '');
  if (type.isNumberLiteral()) return !onlyFalsy || type.value === 0;
  if (type.flags & ts.TypeFlags.BigIntLiteral) return !onlyFalsy || type.value.base10Value === '0';
  if (type.flags & (ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping)) return strings;
  return Boolean(type.flags & (ts.TypeFlags.Number | ts.TypeFlags.BigInt));
}

function onlyText(type) {
  if (type.isUnion()) return type.types.every((part) => onlyText(part) || part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.BooleanLike));
  return rendersText(type, false);
}

function report(node, messageText) {
  diagnostics.push({ category: ts.DiagnosticCategory.Error, code: 9001, file: node.getSourceFile(), start: node.getStart(), length: node.getWidth(), messageText });
}

function visit(node) {
  if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
    const expression = node.expression;
    const inText = isText(node.parent);
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && rendersText(checker.getTypeAtLocation(expression.left), true, !inText)) {
      report(expression.left, inText
        ? 'This shows 0 when it is falsy. Use `condition ? … : null` or compare explicitly, e.g. `count > 0 && …`.'
        : 'This renders 0 or an empty string when it is falsy, which crashes the Android app outside <Text>. Use `condition ? <X /> : null` or compare explicitly, e.g. `count > 0 && <X />`.');
    } else if (rendersView(node.parent) && onlyText(checker.getTypeAtLocation(expression))) {
      report(expression, 'Text inside a View crashes the Android app. Wrap it in <Text>.');
    }
  }
  if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces && rendersView(node.parent)) {
    report(node, 'Text inside a View crashes the Android app. Wrap it in <Text>.');
  }
  ts.forEachChild(node, visit);
}

for (const file of program.getSourceFiles()) {
  if (!file.isDeclarationFile && file.fileName.endsWith('.tsx') && !file.fileName.includes('/node_modules/')) visit(file);
}

if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(ts.sortAndDeduplicateDiagnostics(diagnostics), host));
  process.exit(1);
}
