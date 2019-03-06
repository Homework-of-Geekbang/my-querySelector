export default function querySimpleSelector (startRoot, selectorStr) {
  if (!selectorStr) throw new Error('empty selector')
  const singleSelectorList = getSingleSelectorList(selectorStr)
  return walk(startRoot, (node) => {
    if (matchSelector(node, singleSelectorList)) {
      return node
    } else {
      return null
    }
  })
}

const SelectorTypes = {
  CLASS: 0,
  ID: 1,
  ATTR: 2,
  PSEUDO: 3,
  ELEMENT: 4
}
const specialStartChars = ['.', '#', '[', ':']

function handleEachSelector (singleSelectorStr) {
  if (singleSelectorStr.startsWith('.')) {
    return {
      type: SelectorTypes.CLASS,
      value: singleSelectorStr.slice(1)
    }
  } else if (singleSelectorStr.startsWith('#')) {
    return {
      type: SelectorTypes.ID,
      value: singleSelectorStr.slice(1)
    }
  } else if (singleSelectorStr.startsWith('[')) {
    return {
      type: SelectorTypes.ATTR,
      value: generateAttrSelector(singleSelectorStr)
    }
  } else if (singleSelectorStr.startsWith(':')) {
    return {
      type: SelectorTypes.PSEUDO,
      value: singleSelectorStr.slice(1)
    }
  } else {
    return {
      type: SelectorTypes.ELEMENT,
      value: singleSelectorStr
    }
  }
}

function getSingleSelectorList (selectorStr) {
  const singleSelectorStrList = splitToSingleSelectorStrList(selectorStr)
  return singleSelectorStrList.map(handleEachSelector)
}

// 这里简单处理吧...
function generateAttrSelector (attrSelectorStr) {
  if (last(attrSelectorStr) !== ']') throw new Error('invalid selector')
  const match = /^\[([_a-zA-Z][-_0-9a-zA-Z]*)\s*(?:(=|\|=|\~=|\^=|\$=|\*=)\s*(['"])?(.*)\3)?\s*\]$/.exec(attrSelectorStr)
  if (match == null || (match[2] && !match[3] && !match[4])) throw new Error('invalid selector')
  return {
    combinator: match[2],
    key: match[1],
    value: match[4] || ''
  }
}

function splitToSingleSelectorStrList (selectorStr) {
  if (selectorStr[0] === '*') selectorStr = selectorStr.slice(1)
  const list = []
  let isAttrValueOpen = false
  let isNotOpen = false
  for (let char of selectorStr) {
    if (specialStartChars.includes(char) && !isAttrValueOpen && !isNotOpen) {
      list.push(char)
    } else if (isEmpty(list) && !isAttrValueOpen && !isNotOpen) {
      list.push(char)
    } else {
      if ((char === '"' || char === "'") && last(list)[0] === '[') {
        isAttrValueOpen = !isAttrValueOpen
      }
      if (char === '(' && last(list) === ':not') isNotOpen = true
      if (char === ')' && isNotOpen) isNotOpen = false
      list[list.length - 1] += char
    }
  }
  return list
}

function matchSelector (node, selectorList) {
  let allMatch = true
  for (let selector of selectorList) {
    if (selector.type === SelectorTypes.CLASS) {
      if (!matchClassSelector(node, selector.value)) {
        allMatch = false
        break
      }
    } else if (selector.type === SelectorTypes.ID) {
      if (!matchIdSelector(node, selector.value)) {
        allMatch = false
        break
      }
    } else if (selector.type === SelectorTypes.ATTR) {
      if (!matchAttrSelector(node, selector.value)) {
        allMatch = false
        break
      }
    } else if (selector.type === SelectorTypes.PSEUDO) {
      if (!matchPseudoSelector(node, selector.value)) {
        allMatch = false
        break
      }
    } else {
      if (!matchElementSelector(node, selector.value)) {
        allMatch = false
        break
      }
    }
  }
  return allMatch
}

function matchClassSelector (node, value) {
  return node.classList.contains(value)
}

function matchIdSelector (node, value) {
  return node.id === value
}

function matchElementSelector (node, value) {
  return node.nodeName.toLowerCase() === value.toLowerCase()
}

function matchAttrSelector (node, {key, value, combinator}) {
  if (!node.hasAttribute(key)) {
    return false
  }
  const nodeAttrValue = node.getAttribute(key)
  if (!combinator) {
    return true
  } else {
    if (combinator === '=') {
      return nodeAttrValue === value
    } else if (combinator === '|=') {
      return nodeAttrValue === value || nodeAttrValue.startsWith(value + '-')
    } else if (combinator === '~=') {
      return nodeAttrValue.split(' ').includes(value)
    } else if (combinator === '^=') {
      return nodeAttrValue.startsWith(value)
    } else if (combinator === '$=') {
      return nodeAttrValue.endsWith(value)
    } else if (combinator === '*=') {
      return nodeAttrValue.includes(value)
    } else {
      throw new Error('invalid selector: unknown combinator')
    }
  }
}

// Only Level 3(:nth-child has no `of`)...
// :not
// :checked :disabled
// :root
// :empty :nth-child :nth-last-child :first-child :last-child :only-child
// :nth-of-type :nth-last-of-type :first-of-type :last-of-type :only-of-type
function matchPseudoSelector (node, value) {
  if (value.startsWith('not')) {
    const match = /^not\((.+)\)$/.exec(value)
    if (match == null) throw new Error('invalid selector')
    return !matchSelector(node, getSingleSelectorList(match[1]))
  } else if (value === 'checked') {
    return node.checked
  } else if (value === 'disabled') {
    return node.disabled
  } else if (value === 'root') {
    return node === document.documentElement
  } else if (value === 'empty') {
    return node.childNodes.length === 0
  } else if (value.startsWith('nth-child')) {
    const match = /^nth-child\((.+)\)$/.exec(value)
    if (match == null) throw new Error('invalid selector')
    return checkTree(node, match[1], false)
  } else if (value.startsWith('nth-last-child')) {
    const match = /^nth-last-child\((.+)\)$/.exec(value)
    if (match == null) throw new Error('invalid selector')
    return checkTree(node, match[1], true)
  } else if (value === 'first-child') {
    return checkTree(node, '1', false)
  } else if (value === 'last-child') {
    return checkTree(node, '1', true)
  } else if (value === 'only-child') {
    return node.parentNode.children.length === 1
  } else if (value.startsWith('nth-of-type')) {
    const match = /^nth-of-type\((.+)\)$/.exec(value)
    if (match == null) throw new Error('invalid selector')
    return checkTree(node, match[1], false, true)
  } else if (value.startsWith('nth-last-of-type')) {
    const match = /^nth-last-of-type\((.+)\)$/.exec(value)
    if (match == null) throw new Error('invalid selector')
    return checkTree(node, match[1], true, true)
  } else if (value === 'first-of-type') {
    return checkTree(node, '1', false, true)
  } else if (value === 'last-of-type') {
    return checkTree(node, '1', true, true)
  } else if (value === 'only-of-type') {
    return Array.from(node.parentNode.children).filter(el => el.nodeName === node.nodeName).length === 1
  } else {
    throw new Error('invalid selector: unknown pseudo')
  }
}

function checkTree (node, expr, reverse, useElementType = false) {
  let children = node.parentNode ? Array.from(node.parentNode.children) : [node]
  if (useElementType) children = children.filter(child => child.nodeName === node.nodeName)
  if (reverse) children.reverse()
  if (expr === 'even') {
    return (children.indexOf(node) + 1) % 2 === 0
  } else if (expr === 'odd') {
    return (children.indexOf(node) + 1) % 2 !== 0
  } else if (!Number.isNaN(+expr)) {
    return (children.indexOf(node) + 1) === +expr
  } else {
    const index = children.indexOf(node) + 1
    const [first, second] = parseExpr(expr)
    if (first === 0) {
      return index === second
    } else if (first > 0) {
      let n = 0
      while (first * n + second < index) n++
      return first * n + second === index
    } else {
      let n = 0
      while (first * n + second > index) n++
      return first * n + second === index
    }
  }
}

function parseExpr (expr) {
  const match = /^\s*(-)?([0-9]+)n\s*(?:(\+|-)\s*([0-9]+)\s*)?$/.exec(expr)
  if (match == null) throw new Error('invalid selector')
  const first = match[1] ? -(+match[2]) : +match[2]
  const second = match[3] ? (
    match[3] === '+' ? +match[4] : -(+match[4])
  ) : 0
  return [first, second]
}

/**
 * list {String | Array}
 */
function last (list) {
  return list[list.length - 1]
}

/**
 * list {String | Array}
 */
function isEmpty (list) {
  return list.length === 0
}

function walk (node, callback) {
  const resultNode = callback(node)
  if (resultNode) return resultNode
  for (const child of node.children) {
    const resultNode = walk(child, callback)
    if (resultNode) return resultNode
  }
  return null
}
