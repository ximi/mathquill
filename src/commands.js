/***************************
 * Commands and Operators.
 **************************/

var CharCmds = {}, LatexCmds = {}; //single character commands, LaTeX commands

function proto(parent, child) { //shorthand for prototyping
  child.prototype = parent.prototype;
  return child;
}

var __unshift = Array.prototype.unshift;
function consOverride(Cls, fn) {
  var init = Cls.prototype.init,
  function cons() {
    var self = this, args = arguments;
    __unshift.apply(args, function() {
      init.apply(self, arguments));
    });
    fn.apply(this, args);
  }
  cons.prototype = Cls.prototype;
  return cons;
}

var SupSub = Class(MathCommand, function(proto, super) {
  proto.init = function(cmd, html, replacedFragment) {
    super.init.call(this, cmd, [ html ], replacedFragment);
  };
  proto.latex = function() {
    var latex = this.firstChild.latex();
    if (latex.length === 1)
      return this.cmd + latex;
    else
      return this.cmd + '{' + (latex || ' ') + '}';
  };
  proto.redraw = function() {
    this.respace();
    if (this.next)
      this.next.respace();
    if (this.prev)
      this.prev.respace();
  };
  proto.respace = function() {
    if (
      this.prev && (
        this.prev.cmd === '\\int ' || (
          this.prev instanceof SupSub && this.prev.cmd != this.cmd &&
          this.prev.prev && this.prev.prev.cmd === '\\int '
        )
      )
    ) {
      if (!this.limit) {
        this.limit = true;
        this.jQ.addClass('limit');
      }
    }
    else {
      if (this.limit) {
        this.limit = false;
        this.jQ.removeClass('limit');
      }
    }
    if (this.respaced = this.prev instanceof SupSub && this.prev.cmd != this.cmd && !this.prev.respaced) {
      if (this.limit && this.cmd === '_') {
        this.jQ.css({
          left: -.25-this.prev.jQ.outerWidth()/+this.jQ.css('fontSize').slice(0,-2)+'em',
          marginRight: .1-Math.min(this.jQ.outerWidth(), this.prev.jQ.outerWidth())/+this.jQ.css('fontSize').slice(0,-2)+'em' //1px adjustment very important!
        });
      }
      else {
        this.jQ.css({
          left: -this.prev.jQ.outerWidth()/+this.jQ.css('fontSize').slice(0,-2)+'em',
          marginRight: .1-Math.min(this.jQ.outerWidth(), this.prev.jQ.outerWidth())/+this.jQ.css('fontSize').slice(0,-2)+'em' //1px adjustment very important!
        });
      }
    }
    else if (this.limit && this.cmd === '_') {
      this.jQ.css({
        left: '-.25em',
        marginRight: ''
      });
    }
    else if (this.cmd === '^' && this.next && this.next.cmd === '\\sqrt') {
      this.jQ.css({
        left: '',
        marginRight: Math.max(-.3, .1-this.jQ.outerWidth()/+this.jQ.css('fontSize').slice(0,-2))+'em'
      }).addClass('limit');
    }
    else {
      this.jQ.css({
        left: '',
        marginRight: ''
      });
    }

    return this;
  };
});

//TODO: make this better.
LatexCmds.subscript = LatexCmds._ = Class(SupSub, function(replacedFragment) {
  SupSub.prototype.init.call(this, '_', '<sub></sub>', replacedFragment);
});

LatexCmds.superscript =
LatexCmds.supscript =
LatexCmds['^'] = proto(SupSub, function(replacedFragment) {
  SupSub.prototype.init.call(this, '^', '<sup></sup>', replacedFragment);
});

var Fraction = 
LatexCmds.frac =
LatexCmds.fraction = Class(MathCommand, function(proto, super) {
  proto.init = function(replacedFragment) {
    super.init.call(this, '\\frac', undefined, replacedFragment);
    this.jQ.append('<span style="width:0">&nbsp;</span>');
  };
  proto.html_template = [
    '<span class="fraction"></span>',
    '<span class="numerator"></span>',
    '<span class="denominator"></span>'
  ];
};

var LiveFraction = 
CharCmds['/'] = Class(Fraction, function(proto) {
  proto.placeCursor = function(cursor) {
    if (this.firstChild.isEmpty()) {
      var prev = this.prev;
      while (prev &&
        !(
          prev instanceof BinaryOperator ||
          prev instanceof TextBlock ||
          prev instanceof BigSymbol
        ) //lookbehind for operator
      )
        prev = prev.prev;

      if (prev instanceof BigSymbol && prev.next instanceof SupSub) {
        prev = prev.next;
        if (prev.next instanceof SupSub && prev.next.cmd != prev.cmd)
          prev = prev.next;
      }

      if (prev !== this.prev) {
        var newBlock = create(MathFragment, this.parent, prev, this).blockify();
        newBlock.jQ = this.firstChild.jQ.empty().removeClass('empty').append(newBlock.jQ).data(jQueryDataKey, { block: newBlock });
        newBlock.next = this.lastChild;
        newBlock.parent = this;
        this.firstChild = this.lastChild.prev = newBlock;
      }
    }
    cursor.appendTo(this.lastChild);
  };
});

var SquareRoot = 
LatexCmds.sqrt = Class(MathCommand, function(proto, super) {
  proto.init = function(replacedFragment) {
    super.init.call(this, '\\sqrt', undefined, replacedFragment);
  };
  proto.html_template = [
    '<span><span class="sqrt-prefix">&radic;</span></span>',
    '<span class="sqrt-stem"></span>'
  ];
  proto.redraw = function() {
    var block = this.firstChild.jQ, height = block.outerHeight(true);
    block.css({
      borderTopWidth: height/28+1 // NOTE: Formula will need to change if our font isn't Symbola
    }).prev().css({
      fontSize: .9*height/+block.css('fontSize').slice(0,-2)+'em'
    });
  };
});

// Round/Square/Curly/Angle Brackets (aka Parens/Brackets/Braces)
var Bracket = Class(MathCommand, function(super, proto) {
  proto.init = function(open, close, cmd, end, replacedFragment) {
    super.init.call(this, '\\left'+cmd,
      [
        '<span><span class="paren">' +
        open +
        '</span><span></span><span class="paren">' +
        close +
        '</span></span>'
      ],
      replacedFragment
    );
    this.end = '\\right'+end;
  }
  proto.initBlocks = function(replacedFragment) {
    this.firstChild =
    this.lastChild = (
      replacedFragment && replacedFragment.blockify()
    ) || create(MathBlock);

    this.firstChild.parent = this;
    this.firstChild.jQ = this.jQ.children(':eq(1)')
      .data(jQueryDataKey, {block: this.firstChild})
      .append(this.firstChild.jQ);
  };

  proto.latex = function() {
    return this.cmd + this.firstChild.latex() + this.end;
  };

  proto.redraw = function() {
    var block = this.firstChild.jQ;
    block.prev()
      .add(block.next())
      .css('fontSize',
        block.outerHeight() / (
          +block.css('fontSize').slice(0,-2)*1.02
        )+'em'
      )
    ;
  };
});

LatexCmds.lbrace = CharCmds['{'] = consOverride(Bracket, function(cons, replacedFragment) {
  cons('{', '}', '\\{', '\\}', replacedFragment);
});

LatexCmds.langle =
LatexCmds.lang = consOverride(Bracket, function(cons, replacedFragment) {
  cons('&lang;', '&rang;', '\\langle ', '\\rangle ', replacedFragment);
});

// Closing bracket matching opening bracket above
var CloseBracket = Class(Bracket, function(proto) {
  proto.placeCursor = function(cursor) {
    //if I'm at the end of my parent who is a matching open-paren, and I was not passed
    //  a selection fragment, get rid of me and put cursor after my parent
    if (!this.next && this.parent.parent && this.parent.parent.end === this.end && this.firstChild.isEmpty())
      cursor.backspace().insertAfter(this.parent.parent);
    else
      this.firstChild.blur();
  };
});

LatexCmds.rbrace =
CharCmds['}'] = consOverride(CloseBracket, function(cons, replacedFragment) {
  cons('{','}','\\{','\\}',replacedFragment);
});

LatexCmds.rangle = LatexCmds.rang = consOverride(CloseBracket, function(cons, replacedFragment) {
  cons('&lang;', '&rang;', '\\langle ', '\\rangle ', replacedFragment);
});

var Paren = consOverride(Bracket, function(cons, open, close, replacedFragment) {
  cons(open, close, open, close, replacedFragment);
});

LatexCmds.lparen = CharCmds['('] = consOverride(Paren, function(cons, replacedFragment) {
  cons('(', ')', replacedFragment);
});
LatexCmds.lbrack =
LatexCmds.lbracket =
CharCmds['['] = consOverride(Paren, function(cons, replacedFragment) {
  cons('[', ']', replacedFragment);
});

var CloseParen = consOverride(CloseBracket, function(cons, open, close, replacedFragment) {
  cons(this, open, close, open, close, replacedFragment);
});

LatexCmds.rparen = CharCmds[')'] = consOverride(CloseParen, function(cons, replacedFragment) {
  cons('(', ')', replacedFragment);
});

LatexCmds.rbrack =
LatexCmds.rbracket =
CharCmds[']'] = consOverride(CloseParen, function(cons, replacedFragment) {
  cons('[', ']', replacedFragment);
});

var Pipes = 
LatexCmds.lpipe =
CharCmds['|'] = Class(Paren, function(proto, super) {
  proto.init = function(replacedFragment) {
    super.init.call(this, '|', '|', replacedFragment);
  }
  proto.placeCursor = function(cursor) {
    if (!this.next && this.parent.parent && this.parent.parent.end === this.end && this.firstChild.isEmpty())
      cursor.backspace().insertAfter(this.parent.parent);
    else
      cursor.appendTo(this.firstChild);
  };
});

var TextBlock =
LatexCmds.text =
CharCmds.$ = Class(MathCommand, function(proto, super) {
  proto.init = function(replacedText) {
    if (replacedText instanceof MathFragment)
      this.replacedText = replacedText.remove().jQ.text();
    else if (typeof replacedText === 'string')
      this.replacedText = replacedText;

    super.init.call(this, '\\text');
  };
  proto.html_template = ['<span class="text"></span>'];
  proto.initBlocks = function() {
    this.firstChild =
    this.lastChild =
    this.jQ.data(jQueryDataKey).block = create(InnerTextBlock);

    this.firstChild.parent = this;
    this.firstChild.jQ = this.jQ.append(this.firstChild.jQ);
  };
  proto.placeCursor = function(cursor) {
    (this.cursor = cursor).appendTo(this.firstChild);

    if (this.replacedText)
      for (var i = 0; i < this.replacedText.length; i += 1)
        this.write(this.replacedText.charAt(i));
  };
  proto.write = function(ch) {
    this.cursor.insertNew(create(VanillaSymbol, ch));
  };
  proto.keydown = function(e) {
    //backspace and delete and ends of block don't unwrap
    if (!this.cursor.selection &&
      (
        (e.which === 8 && !this.cursor.prev) ||
        (e.which === 46 && !this.cursor.next)
      )
    ) {
      if (this.isEmpty())
        this.cursor.insertAfter(this);
      return false;
    }
    return this.parent.keydown(e);
  };
  proto.keypress = function(e) {
    this.cursor.deleteSelection();
    var ch = String.fromCharCode(e.which);
    if (ch !== '$')
      this.write(ch);
    else if (this.isEmpty())
      this.cursor.insertAfter(this).backspace().insertNew(
        create(VanillaSymbol, '\\$','$')
      );
    else if (!this.cursor.next)
      this.cursor.insertAfter(this);
    else if (!this.cursor.prev)
      this.cursor.insertBefore(this);
    else { //split apart
      var next = create(TextBlock,
        create(MathFragment, this.firstChild, this.cursor.prev)
      );
      next.placeCursor = function(cursor) { // ********** REMOVEME HACK **********
        this.prev = 0;
        delete this.placeCursor;
        this.placeCursor(cursor);
      };
      next.firstChild.focus = function(){ return this; };
      this.cursor.insertAfter(this).insertNew(next);
      next.prev = this;
      this.cursor.insertBefore(next);
      delete next.firstChild.focus;
    }
    return false;
  };
});

var InnerTextBlock = Class(MathBlock, function(proto, super){}
  proto.blur = function() {
    this.jQ.removeClass('hasCursor');
    if (this.isEmpty()) {
      var textblock = this.parent, cursor = textblock.cursor;
      if (cursor.parent === this)
        this.jQ.addClass('empty');
      else {
        cursor.hide();
        textblock.remove();
        if (cursor.next === textblock)
          cursor.next = textblock.next;
        else if (cursor.prev === textblock)
          cursor.prev = textblock.prev;

        cursor.show().redraw();
      }
    }
    return this;
  };

  proto.focus = function() {
    MathBlock.prototype.focus.call(this);

    var textblock = this.parent;
    if (textblock.next instanceof TextBlock) {
      var innerblock = this,
        cursor = textblock.cursor,
        next = textblock.next.firstChild;

      next.eachChild(function(){
        this.parent = innerblock;
        this.jQ.appendTo(innerblock.jQ);
      });

      if (this.lastChild)
        this.lastChild.next = next.firstChild;
      else
        this.firstChild = next.firstChild;

      next.firstChild.prev = this.lastChild;
      this.lastChild = next.lastChild;

      next.parent.remove();

      if (cursor.prev)
        cursor.insertAfter(cursor.prev);
      else
        cursor.prependTo(this);

      cursor.redraw();
    }
    else if (textblock.prev instanceof TextBlock) {
      var cursor = textblock.cursor;
      if (cursor.prev)
        textblock.prev.firstChild.focus();
      else
        cursor.appendTo(textblock.prev.firstChild);
    }
    return this;
  };
});

// input box to type a variety of LaTeX commands beginning with a backslash
var LatexCommandInput = CharCmds['\\'] = Class(MathCommand, function(proto, super) {
  proto.init = function(replacedFragment) {
    MathCommand.call(this, '\\');
    if (replacedFragment) {
      this.replacedFragment = replacedFragment.detach();
      this.isEmpty = function(){ return false; };
    }
  };
  proto.html_template = ['<span class="latex-command-input"></span>'];
  proto.placeCursor = function(cursor) {
    this.cursor = cursor.appendTo(this.firstChild);
    if (this.replacedFragment)
      this.jQ = this.jQ.add(this.replacedFragment.jQ.addClass('blur').insertBefore(this.jQ));
  };
  proto.latex = function() {
    return '\\' + this.firstChild.latex() + ' ';
  };
  proto.keydown = function(e) {
    if (e.which === 9 || e.which === 13) { //tab or enter
      this.renderCommand();
      return false;
    }
    return this.parent.keydown(e);
  };
  proto.keypress = function(e) {
    var ch = String.fromCharCode(e.which);
    if (ch.match(/[a-z]/i)) {
      this.cursor.deleteSelection();
      this.cursor.insertNew(create(VanillaSymbol, ch));
      return false;
    }
    this.renderCommand();
    if (ch === ' ' || (ch === '\\' && this.firstChild.isEmpty()))
      return false;

    return this.cursor.parent.keypress(e);
  };
  proto.renderCommand = function() {
    this.jQ = this.jQ.last();
    this.remove();
    if (this.next)
      this.cursor.insertBefore(this.next);
    else
      this.cursor.appendTo(this.parent);

    var latex = this.firstChild.latex(), cmd;
    if (latex) {
      if (cmd = LatexCmds[latex])
        cmd = create(cmd, this.replacedFragment, latex);
      else {
        cmd = create(TextBlock, latex);
        cmd.firstChild.focus = function(){ delete this.focus; return true; };
        this.cursor.insertNew(cmd).insertAfter(cmd);
        if (this.replacedFragment)
          this.replacedFragment.remove();

        return;
      }
    }
    else
      cmd = create(VanillaSymbol, '\\backslash ','\\');

    this.cursor.insertNew(cmd);
    if (cmd instanceof Symbol && this.replacedFragment)
      this.replacedFragment.remove();
  };
});


var Binomial =
LatexCmds.binom =
LatexCmds.binomial = Class(MathCommand, function(proto, super) {
  proto.init = function(replacedFragment) {
    MathCommand.call(this, '\\binom', undefined, replacedFragment);
    this.jQ.wrapInner('<span class="array"></span>').prepend('<span class="paren">(</span>').append('<span class="paren">)</span>');
  };

  proto.html_template = ['<span></span>', '<span></span>', '<span></span>'];

  proto.redraw = function() {
    this.jQ.children(':first').add(this.jQ.children(':last'))
      .css('fontSize',
        this.jQ.outerHeight()/(+this.jQ.css('fontSize').slice(0,-2)*.9+2)+'em'
      );
  };
});

var Choose =
LatexCmds.choose = Class(Binomial, function(proto, super) {
  proto.placeCursor = LiveFraction.prototype.placeCursor;
});

var Vector = LatexCmds.vector = Class(MathCommand, function(proto, super) {
  proto.init = function(replacedFragment) {
    MathCommand.call(this, '\\vector', undefined, replacedFragment);
  };
  proto.html_template = ['<span class="array"></span>', '<span></span>'];
  proto.latex = function() {
    return '\\begin{matrix}' + this.foldChildren([], function (latex){
      latex.push(this.latex());
      return latex;
    }).join('\\\\') + '\\end{matrix}';
  };
  proto.placeCursor = function(cursor) {
    this.cursor = cursor.appendTo(this.firstChild);
  };
  proto.keydown = function(e) {
    var currentBlock = this.cursor.parent;

    if (currentBlock.parent === this) {
      if (e.which === 13) { //enter
        var newBlock = create(MathBlock);
        newBlock.parent = this;
        newBlock.jQ = $('<span></span>')
          .data(jQueryDataKey, {block: newBlock})
          .insertAfter(currentBlock.jQ);
        if (currentBlock.next)
          currentBlock.next.prev = newBlock;
        else
          this.lastChild = newBlock;

        newBlock.next = currentBlock.next;
        currentBlock.next = newBlock;
        newBlock.prev = currentBlock;
        this.cursor.appendTo(newBlock).redraw();
        return false;
      }
      else if (e.which === 9 && !e.shiftKey && !currentBlock.next) { //tab
        if (currentBlock.isEmpty()) {
          if (currentBlock.prev) {
            this.cursor.insertAfter(this);
            delete currentBlock.prev.next;
            this.lastChild = currentBlock.prev;
            currentBlock.jQ.remove();
            this.cursor.redraw();
            return false;
          }
          else
            return this.parent.keydown(e);
        }

        var newBlock = create(MathBlock);
        newBlock.parent = this;
        newBlock.jQ = $('<span></span>').data(jQueryDataKey, {block: newBlock}).appendTo(this.jQ);
        this.lastChild = newBlock;
        currentBlock.next = newBlock;
        newBlock.prev = currentBlock;
        this.cursor.appendTo(newBlock).redraw();
        return false;
      }
      else if (e.which === 8) { //backspace
        if (currentBlock.isEmpty()) {
          if (currentBlock.prev) {
            this.cursor.appendTo(currentBlock.prev)
            currentBlock.prev.next = currentBlock.next;
          }
          else {
            this.cursor.insertBefore(this);
            this.firstChild = currentBlock.next;
          }

          if (currentBlock.next)
            currentBlock.next.prev = currentBlock.prev;
          else
            this.lastChild = currentBlock.prev;

          currentBlock.jQ.remove();
          if (this.isEmpty())
            this.cursor.deleteForward();
          else
            this.cursor.redraw();

          return false;
        }
        else if (!this.cursor.prev)
          return false;
      }
    }
    return this.parent.keydown(e);
  };
});

LatexCmds.editable = consOverride(RootMathCommand, function(cons) {
  cons('\\editable');

  createRoot(this.jQ, this.firstChild, false, true);
  var cursor;
  this.placeCursor = function(c) { cursor = c.appendTo(this.firstChild); };
  this.firstChild.blur = function() {
    if (cursor.prev !== this.parent) return; //when cursor is inserted after editable, append own cursor FIXME HACK
    delete this.blur;
    this.cursor.appendTo(this);
    MathBlock.prototype.blur.call(this);
  };
});
