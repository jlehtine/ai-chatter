export function isString(value: unknown): value is string {
    return typeof value === "string";
}

export function asString(value: unknown): string {
    if (isString(value)) {
        return value;
    } else {
        throw new Error("Expected a string but got " + typeof value);
    }
}

export function asStringOpt(value: unknown): string | undefined {
    if (value === undefined) {
        return value;
    } else if (isString(value)) {
        return value;
    } else {
        throw new Error("Expected a string or undefined but got " + typeof value);
    }
}

export function requireNotNull<T>(value: T | null): T {
    if (value !== null) {
        return value;
    } else {
        throw new Error("Expected a non-null value but got null");
    }
}
