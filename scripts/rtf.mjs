// Minimal RTF → plain text extractor good enough for the 국가법령정보센터 law
// exports. Korean is stored as signed 16-bit \uNNNN escapes; images and other
// binary live in {\pict …} / {\* …} destinations we skip wholesale.
const SKIP_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'header',
  'footer',
  'headerl',
  'headerr',
  'footerl',
  'footerr',
  'footnote',
  'listtable',
  'listoverridetable',
  'revtbl',
  'generator',
  'shppict',
  'nonshppict',
  'themedata',
  'colorschememapping',
  'datastore',
  'latentstyles',
  'object',
]);

export function rtfToText(buffer) {
  const data = buffer.toString('latin1');
  const out = [];
  const stack = [{ skip: false, ucSkip: 1 }];
  let state = stack[0];
  let i = 0;
  const n = data.length;

  const emit = (s) => {
    if (!state.skip) out.push(s);
  };

  while (i < n) {
    const c = data[i];
    if (c === '{') {
      state = { skip: state.skip, ucSkip: state.ucSkip };
      stack.push(state);
      i++;
    } else if (c === '}') {
      stack.pop();
      state = stack[stack.length - 1] ?? stack[0];
      i++;
    } else if (c === '\\') {
      const next = data[i + 1];
      // Control symbols and escaped literals.
      if (next === "'") {
        // \'hh — a raw code-page byte; law files are pure \u so treat as filler.
        i += 4;
        continue;
      }
      if (next === '{' || next === '}' || next === '\\') {
        emit(next);
        i += 2;
        continue;
      }
      if (next === '*') {
        // Ignorable destination — skip the whole group.
        state.skip = true;
        i += 2;
        continue;
      }
      if (next === '~') {
        emit(' ');
        i += 2;
        continue;
      }
      if (next === '\n' || next === '\r') {
        emit('\n');
        i += 2;
        continue;
      }
      // Control word.
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(data.slice(i));
      if (!m) {
        i += 2;
        continue;
      }
      const word = m.group ?? m[1];
      const param = m[2] ? parseInt(m[2], 10) : null;
      i += m[0].length;
      if (word === 'u') {
        let code = param ?? 0;
        if (code < 0) code += 65536;
        emit(String.fromCharCode(code));
        // Skip the following ucSkip fallback characters.
        let toSkip = state.ucSkip;
        while (toSkip > 0 && i < n) {
          if (data[i] === '\\' && data[i + 1] === "'") i += 4;
          else if (data[i] === '{' || data[i] === '}') break;
          else i += 1;
          toSkip -= 1;
        }
      } else if (word === 'uc') {
        state.ucSkip = param ?? 1;
      } else if (SKIP_DESTINATIONS.has(word)) {
        state.skip = true;
      } else if (word === 'par' || word === 'row' || word === 'line' || word === 'sect') {
        emit('\n');
      } else if (word === 'cell' || word === 'tab' || word === 'nestcell') {
        emit('\t');
      } else if (word === 'bin' && param && param > 0) {
        i += param; // skip binary payload
      }
    } else if (c === '\r' || c === '\n') {
      i++;
    } else {
      emit(c);
      i++;
    }
  }
  return out.join('');
}
