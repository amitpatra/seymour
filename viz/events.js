"use strict";

class Event {
  constructor(sourceLoc, env) {
    this.id = Event.nextEventId++;
    this.sourceLoc = sourceLoc;
    this.env = env;
    this.children = [];
  }

  toMicroVizString() {
    throw new Error('abstract method!');
  }

  _valueString(v) {
    if (typeof v === 'function') {
      return '{function}';
    } else if (v === undefined) {
      return 'undefined';
    } else if (v === Infinity) {
      return '∞';
    } else if (v === -Infinity) {
      return '-∞';
    } else if (v instanceof Obj) {
      return v.id < Event.objectIdEmojis.length ? Event.objectIdEmojis[v.id] : '#' + v.id;
    } else {
      return JSON.stringify(v);
    }
  }

  subsumes(that) {
    return false;
  }
}

Event.nextEventId = 0;

Event.objectIdEmojis = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧',
  '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷',
  '🐢', '🐍', '🦎', '🦂', '🦀', '🦑', '🐙', '🦐', '🐠', '🐟', '🐡', '🐬', '🦈', '🐳', '🐋', '🐊', '🐆',
  '🐅', '🐃', '🐂', '🐄', '🦌', '🐪', '🐫', '🐘', '🦏', '🦍', '🐎', '🐖', '🐐', '🐏', '🐑', '🐕', '🐩',
  '🐈', '🐓', '🦃', '🕊', '🐇', '🐁', '🐀', '🐿', '🐉', '🐲', '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉',
  '🍇', '🍓', '🍈', '🍒', '🍑', '🍍', '🥝', '🥑', '🍅', '🍆', '🥒', '🥕', '🌽', '🌶', '🥔', '🍠', '🌰',
  '🥜', '🍯', '🥐', '🍞', '🥖', '🧀', '🥚', '🍳', '🥓', '🥞', '🍤', '🍗', '🍖', '🍕', '🌭', '🍔', '🍟',
  '🥙', '🌮', '🌯', '🍝', '🍜', '🍲', '🍣', '🍱', '🍦', '🍧', '🍨', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫',
  '🍿', '🍩', '🍪', '🥛', '🍼', '☕️', '🍵', '🍶', '🍺', '🍷', '🥃', '🍸', '🍹', '⚽️', '🏀', '🏈', '⚾️',
  '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '⛸', '🏄', '🎸', '🎷', '🏠', '🏰', '😀', '😱', '👦🏻', '👨🏾'];

class ProgramEvent extends Event {
  constructor(sourceLoc) {
    super(sourceLoc, null);
    // also: activationEnv
  }
}

class SendEvent extends Event {
  constructor(sourceLoc, env, recv, selector, args, activationPathToken) {
    super(sourceLoc, env);
    this.recv = recv;
    this.selector = selector;
    this.args = args;
    this.activationPathToken = activationPathToken;
    // also: activationEnv, returnValue
  }

  toDetailString() {
    let s =
        'receiver: ' + this._valueString(this.recv) + '\n' +
        'selector: ' + this.selector + '\n' +
        'arguments: [' + this.args.map(x => this._valueString(x)).join(', ') + ']\n';
    if (this.hasOwnProperty('returnValue')) {
      s += '⇒ ' + this._valueString(this.returnValue);
    }
    return s;
  }

  isInlineBlockCall() {
    const isBlockCall = this.recv instanceof BlockClosure && this.selector === 'call';
    if (!isBlockCall) return false;

    let someParentContains = false;
    let env = this.env;
    while (env) {
      const send = env.programOrSendEvent;
      someParentContains = someParentContains || 
        (send.sourceLoc && send.sourceLoc.contains(this.activationEnv.sourceLoc));
      env = env.callerEnv;
    }
    return isBlockCall && someParentContains;
  }
}

class VarDeclEvent extends Event {
  constructor(sourceLoc, env, name, value) {
    super(sourceLoc, env);
    this.name = name;
    this.value = value;
  }

  toMicroVizString() {
    return this.name + ' = ' + this._valueString(this.value);
  }
}

class VarAssignmentEvent extends Event {
  constructor(sourceLoc, env, declEnv, name, value) {
    super(sourceLoc, env);
    this.declEnv = declEnv;
    this.name = name;
    this.value = value;
  }

  subsumes(that) {
    return (that instanceof VarAssignmentEvent || that instanceof VarDeclEvent) &&
        this.name === that.name && this.declEnv === that.declEnv;
  }

  toMicroVizString() {
    return this.name + ' = ' + this._valueString(this.value);
  }
}

class InstVarAssignmentEvent extends Event {
  constructor(sourceLoc, env, obj, name, value) {
    super(sourceLoc, env);
    this.obj = obj;
    this.name = name;
    this.value = value;
  }

  subsumes(that) {
    return that instanceof InstVarAssignmentEvent &&
        this.receiver === that.receiver && this.name === that.name;
  }

  toMicroVizString() {
    return this._valueString(this.obj) + '.' + this.name + ' = ' + this._valueString(this.value);
  }
}

class InstantiationEvent extends Event {
  // TODO: how should we handle the call to init?
  constructor(sourceLoc, env, _class, args, newInstance) {
    super(sourceLoc, env);
    this.class = _class;
    this.args = args;
    this.newInstance = newInstance;
  }

  toMicroVizString() {
    return 'new ' + this._valueString(this.class) + ' -> ' + this._valueString(this.newInstance);
  }
}

class ReturnEvent extends Event {
  constructor(sourceLoc, env, value) {
    super(sourceLoc, env);
    this.value = value;
  }

  toMicroVizString() {
    throw new Error('abstract method');
  }
}

class LocalReturnEvent extends ReturnEvent {
  toMicroVizString() {
    return '→ ' + this._valueString(this.value);
  }
}

class NonLocalReturnEvent extends ReturnEvent {
  toMicroVizString() {
    return 'return ' + this._valueString(this.value);
  }
}

class ShowEvent extends Event {
  constructor(sourceLoc, env, string) {
    super(sourceLoc, env);
    this.string = string;
  }

  toMicroVizString() { return this.string; }
}

class ErrorEvent extends Event {
  constructor(sourceLoc, env, errorString) {
    super(sourceLoc, env);
    this.errorString = errorString;
  }

  toMicroVizString() { return '▨'; }
}
