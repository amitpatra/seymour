"use strict";

class AST {
  constructor(sourceLoc) {
    this.sourceLoc = sourceLoc;
  }

  toInstruction(next) {
    throw new Error('abstract method');
  }
}

class Ident extends AST {
  constructor(sourceLoc, name) {
    super(sourceLoc);
    if (name === '') debugger;
    this.name = name;
  }

  toInstruction(next) {
    throw new Error('not supported');
  }
}

class Seq extends AST {
  constructor(sourceLoc, asts) {
    super(sourceLoc);
    this.asts = asts;
  }

  toInstruction(next) {
    return this.asts.reduceRight((rest, ast) => ast.toInstruction(rest), next);
  }
}

class VarDecl extends AST {
  constructor(sourceLoc, name, expr) {
    super(sourceLoc);
    this.name = name;
    this.expr = expr;
  }

  toInstruction(next) {
    return this.expr.toInstruction(new IDeclVar(this.name.name, next));
  }
}

class VarAssign extends AST {
  constructor(sourceLoc, name, expr) {
    super(sourceLoc);
    this.name = name;
    this.expr = expr;
  }

  toInstruction(next) {
    return this.expr.toInstruction(new IPopIntoVar(this.name.name, next));
  }
}

class InstVarAssign extends AST {
  constructor(sourceLoc, name, expr) {
    super(sourceLoc);
    this.name = name;
    this.expr = expr;
  }

  toInstruction(next) {
    return this.expr.toInstruction(new IPopIntoInstVar(this.name.name, next));
  }
}

class NonLocalReturn extends AST {
  constructor(sourceLoc, value) {
    super(sourceLoc);
    this.value = value;
  }

  toInstruction(next) {
    return this.value.toInstruction(new INonLocalReturn(next));
  }
}

class ExpStmt extends AST {
  constructor(sourceLoc, exp) {
    super(sourceLoc);
    this.exp = exp;
  }

  toInstruction(next) {
    return this.exp.toInstruction(new IDrop(next));
  }
}

class ClassDecl extends AST {
  constructor(sourceLoc, name, superClassName, instVarNames) {
    super(sourceLoc);
    this.name = name;
    this.superClassName = superClassName;
    this.instVarNames = instVarNames;
  }

  toInstruction(next) {
    return new IPushFromVar(this.superClassName.name,
      new IDeclClass(this.name.name, this.instVarNames.map(ident => ident.name), next));
  }
}

class MethodDecl extends AST {
  constructor(sourceLoc, className, selectorParts, formals, body) {
    super(sourceLoc);
    this.className = className;
    this.selectorParts = selectorParts;
    this.formals = formals;
    this.body = body;
  }

  toInstruction(next) {
    return new IPushFromVar(this.className.name,
      new IDeclMethod(
        this.selectorParts.map(ident => ident.name).join(''),
        this.formals.map(ident => ident.name),
        this.body.toInstruction(new IPushThis(new INonLocalReturn())),
        next));
  }
}

class Send extends AST {
  constructor(sourceLoc, recv, selectorParts, args) {
    super(sourceLoc);
    this.recv = recv;
    this.selectorParts = selectorParts;
    this.args = args;
  }

  toInstruction(next) {
    const selector = this.selectorParts.map(ident => ident.name).join('');
    return this.recv.toInstruction(
        this.args.reduceRight((rest, arg) => arg.toInstruction(rest),
            new ISend(selector, this.args.length, next)));
  }
}

class SuperSend extends AST {
  constructor(sourceLoc, selectorParts, args) {
    super(sourceLoc);
    this.selectorParts = selectorParts;
    this.args = args;
  }

  toInstruction(next) {
    const selector = this.selectorParts.map(ident => ident.name).join('');
    return this.args.reduceRight(
      (rest, arg) => arg.toInstruction(rest),
      new ISuperSend(selector, this.args.length, next));
  }
}

class Var extends AST {
  constructor(sourceLoc, name) {
    super(sourceLoc);
    this.name = name;
  }

  toInstruction(next) {
    return new IPushFromVar(this.name, next);
  }
}

class InstVar extends AST {
  constructor(sourceLoc, name) {
    super(sourceLoc);
    this.name = name;
  }

  toInstruction(next) {
    return new IPushFromInstVar(this.name.name, next);
  }
}

class LocalReturn extends AST {
  constructor(sourceLoc, value) {
    super(sourceLoc);
    this.value = value;
  }

  toInstruction(next) {
    return this.value.toInstruction(new ILocalReturn(next));
  }
}

class Block extends AST {
  constructor(sourceLoc, formals, bodyExpr) {
    super(sourceLoc);
    this.formals = formals;
    this.bodyExpr = bodyExpr;
  }

  toInstruction(next) {
    return new IBlock(
        this.formals.map(ident => ident.name),
        this.bodyExpr.toInstruction(new ILocalReturn()),
        next);
  }
}

// TODO: ArrayLit

class New extends AST {
  constructor(sourceLoc, _class, args) {
    super(sourceLoc);
    this.class = _class;
    this.args = args;
  }

  toInstruction(next) {
    return this.class.toInstruction(
      new INew(
        new IDup(
          this.args.reduceRight(
            (rest, arg) => arg.toInstruction(rest),
            new ISend('init', this.args.length, new IDrop(next))))));
  }
}

class Lit extends AST {
  constructor(sourceLoc, value) {
    super(sourceLoc);
    this.value = value;
  }

  toInstruction(next) {
    return new IPush(this.value, next);
  }
}

class This extends AST {
  constructor(sourceLoc) {
    super(sourceLoc);
  }

  toInstruction(next) {
    return new IPushThis(next);
  }
}
