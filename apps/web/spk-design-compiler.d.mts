export type DesignTheme = "light" | "dark";
export interface DocumentDiagnostic {
    path: string;
    message: string;
    line?: number;
}
export declare class DesignDocumentError extends Error {
    readonly diagnostics: DocumentDiagnostic[];
    constructor(diagnostics: DocumentDiagnostic[]);
}
export interface DesignTypography {
    family: string[];
    size: string;
    weight: number;
    lineHeight: number;
}
export interface DesignFont {
    family: string;
    src: string;
    weight: number;
    style: "normal" | "italic";
}
export interface DesignDocument {
    schema: "spk.design.v1";
    name: string;
    defaultTheme: DesignTheme;
    brand: {
        primary: string;
    };
    themes: Partial<Record<DesignTheme, Record<string, string>>>;
    typography: Record<"body" | "heading" | "mono", DesignTypography>;
    radius: Record<"sm" | "md" | "lg" | "full", string>;
    spacing: Record<"control" | "panel" | "section", string>;
    layout: {
        contentMaxWidth: string;
    };
    fonts: DesignFont[];
    body: string;
    /** Only declared themes exist; omitted fields explicitly record template inheritance. */
    sources: Record<string, "document" | "template">;
}
export interface ProductScreen {
    id: string;
    title: string;
    path: string;
    /** Optional concrete application URL for a parameterized product route. */
    previewPath?: string;
    viewport: {
        width: number;
        height: number;
    };
    requirements: string[];
}
export interface ProductRequirement {
    id: string;
    title: string;
    scope: "included" | "excluded" | "later";
}
export interface ProductFlow {
    id: string;
    from: string;
    to: string;
    action: string;
}
export interface ProductDocument {
    schema: "spk.product.v1";
    screens: ProductScreen[];
    flows: ProductFlow[];
    requirements: ProductRequirement[];
    body: string;
}
/** Restrict executable color values to literal CSS colors; no vars, URLs or declarations. */
export declare function colorToHsl(input: string): string;
export declare function fontFamilyCss(families: readonly string[]): string;
export declare function parseDesignDocument(markdown: string): DesignDocument;
export declare function parseProductDocument(markdown: string): ProductDocument;
/** Product routes can describe dynamic pages while remaining project-relative. */
export declare function isProjectRoute(value: string): boolean;
/** Compare route shapes without inventing parameter values or changing source. */
export declare function projectRoutePattern(value: string): string;
/** Concrete URLs are required only by an actual navigation/capture consumer. */
export declare function isConcreteProjectRoute(value: string): boolean;
/** An explicit example must belong to the declared page, independent of Build. */
export declare function isProjectRoutePreview(route: string, previewPath: string): boolean;
export declare function designScreenPreviewPath(screen: {
    path: string;
    previewPath?: string;
}): string | undefined;
export declare function designCssVariables(design: DesignDocument, theme?: DesignTheme): Record<string, string>;
export declare function compileDesignCss(design: DesignDocument): string;
export declare function defaultDesignDocument(): DesignDocument;
