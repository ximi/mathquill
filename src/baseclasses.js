/*************************************************
 * Abstract base classes of blocks and commands.
 ************************************************/

/**
 *  MyClass = Class(MySuperClass, function(proto, super) {
 *    ...
 *  });
 */
function Class(parent, callback) {
  if (typeof parent === 'function') {
    callback = parent;
    parent = Object;
  }

  var ctor = function() {}
  ctor.prototype = new parent;

  if (typeof callback === 'function') {
    callback(
      ctor.prototype, parent.prototype,
      ctor, parent
    )
  }

  return ctor;
}

// opting to use create(Cls, args...) instead of `new` or `.create()`
// because it works better with minification.
function create(Cls) {
  var obj = new Cls,
      args = __slice.apply(arguments, 1);

  (typeof obj.init === 'function') && obj.init.apply(obj, args);
  return obj;
}
/**
 * MathElement is the core Math DOM tree node prototype.
 * Both MathBlock's and MathCommand's descend from it.
 */
var MathElement = Class(function(proto) {
  proto.prev = 0;
  proto.next = 0;
  proto.parent = 0;
  proto.firstChild = 0;
  proto.lastChild = 0;
  proto.eachChild = function(fn) {
    for (var child = this.firstChild; child; child = child.next)
      if (fn.call(child) === false) break;

    return this;
  };
  proto.foldChildren = function(fold, fn) {
    this.eachChild(function() {
      fold = fn.call(this, fold);
    });
    return fold;
  };
  proto.keydown = function(e) {
    return this.parent.keydown(e);
  };
  proto.keypress = function(e) {
    return this.parent.keypress(e);
  };
});

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * Descendant commands are organized into blocks.
 * May be passed a MathFragment that's being replaced.
 */
var MathCommand = Class(MathElement, function(proto, super) {
  proto.init = function(cmd, html_template, replacedFragment) {
    if (!arguments.length) return;
    var self = this; // minifier optimization

    self.cmd = cmd;
    if (html_template) self.html_template = html_template;

    self.jQ = $(self.html_template[0]).data(jQueryDataKey, {cmd: self});
    self.initBlocks(replacedFragment);
  }

  proto.initBlocks = function(replacedFragment) {
    var self = this;
    //single-block commands
    if (self.html_template.length === 1) {
      self.firstChild =
      self.lastChild =
      self.jQ.data(jQueryDataKey).block =
        (replacedFragment && replacedFragment.blockify()) || new MathBlock;

      self.firstChild.parent = self;
      self.firstChild.jQ = self.jQ.append(self.firstChild.jQ);

      return;
    }
    //otherwise, the succeeding elements of html_template should be child blocks
    var newBlock, prev, num_blocks = self.html_template.length;
    this.firstChild = newBlock = prev =
      (replacedFragment && replacedFragment.blockify()) || new MathBlock;

    newBlock.parent = self;
    newBlock.jQ = $(self.html_template[1])
      .data(jQueryDataKey, {block: newBlock})
      .append(newBlock.jQ)
      .appendTo(self.jQ);

    newBlock.blur();

    for (var i = 2; i < num_blocks; i += 1) {
      newBlock = new MathBlock;
      newBlock.parent = self;
      newBlock.prev = prev;
      prev.next = newBlock;
      prev = newBlock;

      newBlock.jQ = $(self.html_template[i])
        .data(jQueryDataKey, {block: newBlock})
        .appendTo(self.jQ);

      newBlock.blur();
    }
    self.lastChild = newBlock;
  };
  proto.latex = function() {
    return this.foldChildren(this.cmd, function(latex){
      return latex + '{' + (this.latex() || ' ') + '}';
    });
  };
  proto.remove = function() {
    var self = this;
        prev = self.prev;
        next = self.next;
        parent = self.parent;

    if (prev)
      prev.next = next;
    else
      parent.firstChild = next;

    if (next)
      next.prev = prev;
    else
      parent.lastChild = prev;

    self.jQ.remove();

    return self;
  };
  proto.respace = $.noop; //placeholder for context-sensitive spacing
  proto.placeCursor = function(cursor) {
    //append the cursor to the first empty child, or if none empty, the last one
    cursor.appendTo(this.foldChildren(this.firstChild, function(prev){
      return prev.isEmpty() ? prev : this;
    }));
  };
  proto.isEmpty = function() {
    return this.foldChildren(true, function(isEmpty){
      return isEmpty && this.isEmpty();
    });
  };
});

/**
 * Lightweight command without blocks or children.
 */
var Symbol = Class(function(proto, super) {
  proto.init = function(cmd, html) {
    super.init.call(this, cmd, [ html ]);
  };

  proto.initBlocks = $.noop;
  proto.latex = function(){ return this.cmd; };
  proto.placeCursor = $.noop;
  proto.isEmpty = function(){ return true; };
});

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
var MathBlock = Class(MathElement, function(proto) {
  proto.latex = function() {
    return this.foldChildren('', function(latex){
      return latex + this.latex();
    });
  };
  proto.isEmpty = function() {
    return this.firstChild === 0 && this.lastChild === 0;
  };
  proto.focus = function() {
    this.jQ.addClass('hasCursor');
    if (this.isEmpty())
      this.jQ.removeClass('empty');

    return this;
  };
  proto.blur = function() {
    this.jQ.removeClass('hasCursor');
    if (this.isEmpty())
      this.jQ.addClass('empty');

    return this;
  };
});

/**
 * An entity outside the Math DOM tree with one-way pointers (so it's only
 * a "view" of part of the tree, not an actual node/entity in the tree)
 * that delimit a list of symbols and operators.
 */
var MathFragment = Class(function(proto) {
  proto.init = function(parent, prev, next) {
    if (!arguments.length) return;

    var self = this;

    self.parent = parent;
    self.prev = prev || 0; //so you can do 'new MathFragment(block)' without
    self.next = next || 0; //ending up with this.prev or this.next === undefined

    self.jQinit(self.fold($(), function(jQ){ return this.jQ.add(jQ); }));
  };

  proto.remove = MathCommand.prototype.remove;
  proto.jQinit = function(children) {
    this.jQ = children;
  };
  proto.each = function(fn) {
    for (var el = this.prev.next || this.parent.firstChild; el !== this.next; el = el.next)
      if (fn.call(el) === false) break;

    return this;
  };
  proto.fold = function(fold, fn) {
    this.each(function() {
      fold = fn.call(this, fold);
    });
    return fold;
  };
  proto.blockify = function() {
    var self = this;
        prev = self.prev;
        next = self.next;
        parent = self.parent;
        newBlock = new MathBlock;
        newFirstChild = newBlock.firstChild = this.prev.next || this.parent.firstChild;
        newLastChild = newBlock.lastChild = this.next.prev || this.parent.lastChild;

    if (prev)
      prev.next = next;
    else
      parent.firstChild = next;

    if (next)
      next.prev = prev;
    else
      parent.lastChild = prev;

    newFirstChild.prev = self.prev = 0;
    newLastChild.next = self.next = 0;

    self.parent = newBlock;
    self.each(function(){ this.parent = newBlock; });

    newBlock.jQ = self.jQ;

    return newBlock;
  };
});
