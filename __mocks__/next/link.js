const React = require('react')
module.exports = function MockNextLink({ children, ...props }) {
  return React.createElement('a', props, children)
}
