"use strict";

// ---------------------------------------------------------------------------
// Shared helpers (validation + geometry formulas, used by plain and colorful
// figures alike so the formulas live in exactly one place)
// ---------------------------------------------------------------------------

function requireFiniteNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number, got ${value}`);
    }
}

function requirePositiveNumber(value, name) {
    requireFiniteNumber(value, name);
    if (value <= 0) {
        throw new RangeError(`${name} must be positive, got ${value}`);
    }
}

const Geometry = {
    squareArea: (width) => width * width,
    squarePerimeter: (width) => 4 * width,

    rectangleArea: (width, height) => width * height,
    rectanglePerimeter: (width, height) => 2 * (width + height),

    circleArea: (radius) => Math.PI * radius * radius,
    circlePerimeter: (radius) => 2 * Math.PI * radius,

    annulusArea: (outerRadius, innerRadius) =>
        Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius),
    annulusPerimeter: (outerRadius, innerRadius) =>
        2 * Math.PI * outerRadius + 2 * Math.PI * innerRadius,
};

function validateAnnulusRadii(outerRadius, innerRadius) {
    requirePositiveNumber(outerRadius, "outerRadius");
    requirePositiveNumber(innerRadius, "innerRadius");
    if (innerRadius >= outerRadius) {
        throw new RangeError(
            `innerRadius (${innerRadius}) must be less than outerRadius (${outerRadius})`
        );
    }
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

class Color {
    constructor(red, green, blue) {
        for (const [name, value] of [["red", red], ["green", green], ["blue", blue]]) {
            if (!Number.isInteger(value) || value < 0 || value > 255) {
                throw new RangeError(`${name} must be an integer between 0 and 255, got ${value}`);
            }
        }
        this.red = red;
        this.green = green;
        this.blue = blue;
    }

    toString() {
        const toHex = (part) => part.toString(16).toUpperCase().padStart(2, "0");
        return `#${toHex(this.red)}${toHex(this.green)}${toHex(this.blue)}`;
    }
}

// ---------------------------------------------------------------------------
// Abstract base classes
// ---------------------------------------------------------------------------

class Figure {
    constructor(x, y) {
        if (new.target === Figure) {
            throw new Error("Cannot instantiate abstract class Figure directly");
        }
        requireFiniteNumber(x, "x");
        requireFiniteNumber(y, "y");
        this.x = x;
        this.y = y;
    }

    move(dX, dY) {
        requireFiniteNumber(dX, "dX");
        requireFiniteNumber(dY, "dY");
        this.x += dX;
        this.y += dY;
    }

    resetPosition() {
        this.x = 0;
        this.y = 0;
    }

    area() {
        throw new Error("Not implemented");
    }

    perimeter() {
        throw new Error("Not implemented");
    }

    // Name shown in toString(), e.g. "Square" (overridden by every concrete figure).
    get kind() {
        throw new Error("Not implemented");
    }

    // Size part of toString(), e.g. "width = 10" (overridden by every concrete figure).
    sizeDescription() {
        throw new Error("Not implemented");
    }

    // The comma-separated parts inside the parentheses of toString().
    describeParts() {
        return [`{${this.x}, ${this.y}}`, this.sizeDescription()];
    }

    toString() {
        return `${this.kind}(${this.describeParts().join(", ")})`;
    }
}

class ColorfulFigure extends Figure {
    constructor(x, y, color) {
        if (new.target === ColorfulFigure) {
            throw new Error("Cannot instantiate abstract class ColorfulFigure directly");
        }
        if (!(color instanceof Color)) {
            throw new TypeError("color must be an instance of Color");
        }
        super(x, y);
        this.color = color;
    }

    describeParts() {
        return [...super.describeParts(), `color = ${this.color}`];
    }
}

// ---------------------------------------------------------------------------
// Concrete figures
// ---------------------------------------------------------------------------

class Square extends Figure {
    constructor(x, y, width) {
        super(x, y);
        requirePositiveNumber(width, "width");
        this.width = width;
    }

    get kind() { return "Square"; }
    sizeDescription() { return `width = ${this.width}`; }
    area() { return Geometry.squareArea(this.width); }
    perimeter() { return Geometry.squarePerimeter(this.width); }
}

class Rectangle extends Figure {
    constructor(x, y, width, height) {
        super(x, y);
        requirePositiveNumber(width, "width");
        requirePositiveNumber(height, "height");
        this.width = width;
        this.height = height;
    }

    get kind() { return "Rectangle"; }
    sizeDescription() { return `size = ${this.width} x ${this.height}`; }
    area() { return Geometry.rectangleArea(this.width, this.height); }
    perimeter() { return Geometry.rectanglePerimeter(this.width, this.height); }
}

class Circle extends Figure {
    constructor(x, y, radius) {
        super(x, y);
        requirePositiveNumber(radius, "radius");
        this.radius = radius;
    }

    get kind() { return "Circle"; }
    sizeDescription() { return `radius = ${this.radius}`; }
    area() { return Geometry.circleArea(this.radius); }
    perimeter() { return Geometry.circlePerimeter(this.radius); }
}

class Annulus extends Figure {
    constructor(x, y, outerRadius, innerRadius) {
        super(x, y);
        validateAnnulusRadii(outerRadius, innerRadius);
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
    }

    get kind() { return "Annulus"; }
    sizeDescription() {
        return `ext. radius = ${this.outerRadius}, int. radius = ${this.innerRadius}`;
    }
    area() { return Geometry.annulusArea(this.outerRadius, this.innerRadius); }
    perimeter() { return Geometry.annulusPerimeter(this.outerRadius, this.innerRadius); }
}

// ---------------------------------------------------------------------------
// Colorful figures
// ---------------------------------------------------------------------------

class ColorfulSquare extends ColorfulFigure {
    constructor(x, y, width, color) {
        super(x, y, color);
        requirePositiveNumber(width, "width");
        this.width = width;
    }

    get kind() { return "Square"; }
    sizeDescription() { return `width = ${this.width}`; }
    area() { return Geometry.squareArea(this.width); }
    perimeter() { return Geometry.squarePerimeter(this.width); }
}

class ColorfulRectangle extends ColorfulFigure {
    constructor(x, y, width, height, color) {
        super(x, y, color);
        requirePositiveNumber(width, "width");
        requirePositiveNumber(height, "height");
        this.width = width;
        this.height = height;
    }

    get kind() { return "Rectangle"; }
    sizeDescription() { return `size = ${this.width} x ${this.height}`; }
    area() { return Geometry.rectangleArea(this.width, this.height); }
    perimeter() { return Geometry.rectanglePerimeter(this.width, this.height); }
}

class ColorfulCircle extends ColorfulFigure {
    constructor(x, y, radius, color) {
        super(x, y, color);
        requirePositiveNumber(radius, "radius");
        this.radius = radius;
    }

    get kind() { return "Circle"; }
    sizeDescription() { return `radius = ${this.radius}`; }
    area() { return Geometry.circleArea(this.radius); }
    perimeter() { return Geometry.circlePerimeter(this.radius); }
}

class ColorfulAnnulus extends ColorfulFigure {
    constructor(x, y, outerRadius, innerRadius, color) {
        super(x, y, color);
        validateAnnulusRadii(outerRadius, innerRadius);
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
    }

    get kind() { return "Annulus"; }
    sizeDescription() {
        return `ext. radius = ${this.outerRadius}, int. radius = ${this.innerRadius}`;
    }
    area() { return Geometry.annulusArea(this.outerRadius, this.innerRadius); }
    perimeter() { return Geometry.annulusPerimeter(this.outerRadius, this.innerRadius); }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function runDemo() {
    const figures = [
        new Square(10, 35, 10),
        new Rectangle(-10, 20, 20, 15),
        new Circle(20, -10, 15),
        new Annulus(20, -10, 15, 5),
        new ColorfulSquare(10, 35, 10, new Color(255, 122, 30)),
        new ColorfulRectangle(-10, 20, 20, 15, new Color(127, 170, 232)),
        new ColorfulCircle(20, -10, 15, new Color(0, 238, 0)),
        new ColorfulAnnulus(20, -10, 15, 5, new Color(238, 51, 51)),
    ];

    console.log("=== Figures ===");
    for (const figure of figures) {
        console.log(figure.toString());
        console.log(`  area      = ${figure.area().toFixed(2)}`);
        console.log(`  perimeter = ${figure.perimeter().toFixed(2)}`);
    }

    console.log("\n=== move() and resetPosition() ===");
    const square = figures[4];
    console.log(`initial:            ${square}`);
    square.move(5, -15);
    console.log(`after move(5, -15): ${square}`);
    square.resetPosition();
    console.log(`after reset:        ${square}`);

    console.log("\n=== Abstract classes and validation ===");
    const attempts = [
        ["new Figure(0, 0)", () => new Figure(0, 0)],
        ["new ColorfulFigure(0, 0, color)", () => new ColorfulFigure(0, 0, new Color(0, 0, 0))],
        ["new Color(256, 0, 0)", () => new Color(256, 0, 0)],
        ["new Annulus(0, 0, 5, 10)", () => new Annulus(0, 0, 5, 10)],
    ];
    for (const [label, attempt] of attempts) {
        try {
            attempt();
            console.log(`${label} -> no error (unexpected)`);
        } catch (error) {
            console.log(`${label} -> ${error.name}: ${error.message}`);
        }
    }
}

// Run the demo with `node figures.js` and in the browser (prints to the console),
// but not when another Node file does require("./figures.js").
if (typeof module === "undefined" || require.main === module) {
    runDemo();
}

if (typeof module !== "undefined") {
    module.exports = {
        Color,
        Figure,
        ColorfulFigure,
        Square,
        Rectangle,
        Circle,
        Annulus,
        ColorfulSquare,
        ColorfulRectangle,
        ColorfulCircle,
        ColorfulAnnulus,
    };
}
