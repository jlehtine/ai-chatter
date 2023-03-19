export function isString(value: unknown): value is string {
    return typeof value === "string";
}

export function asStringOpt(value: unknown): string | undefined {
    if (value === undefined) {
        return value;
    } else if (isString(value)) {
        return value;
    } else {
        throw new Error("Expected a string but got " + typeof value);
    }
}
