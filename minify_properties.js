#!/usr/local/bin/node

var props = {
  p: 'parent',
  n: 'next',
  v: 'prev',
  f: 'firstChild',
  l: 'lastChild',
  i: 'insertBefore',
  a: 'insertAfter',
  n: 'insertNew',
  r: 'remove',
  P: 'prependTo',
  A: 'appendTo',
  e: 'eachChild',
  C: 'foldChildren',
  E: 'each',
  F: 'fold',
  c: 'cursor',
  s: 'selection',
  I: 'intervalId',
  h: 'html_template',
  b: 'blockify'
};

for (var c in props)
  props[c] = RegExp('\\.'+props[c]+'(?=\\W)', 'g');

process.openStdin().on('data', function(data) {
  data = ''+data;
  for (var c in props)
    data = data.replace(props[c], '.'+c);
  process.stdout.write(data);
});
