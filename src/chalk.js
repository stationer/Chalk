/**
 * Chalk is a glorified textarea
 * Creates a side-by-side textarea-contenteditable-iframe for quick views of code edits
 */
class Chalk {
    /**
     * Accept some options to override defaults
     *  tab - the tab string to be inserted when pressing the tab key
     *  styles - an array of css rules
     *
     * @param options
     */
    constructor(options = {}) {
        this.tab = options.tab || '    ';
        this.styles = options.styles || Chalk.getDefaultStylesheet();
        this.stylesheet = null;
        if (this.styles && this.styles.length) {
            this.stylesheet = Chalk.applyStylesheet(this.styles);
        }
    }

    /**
     * Accepts a query selector and applies chalk to each found element
     *
     * @param selector
     */
    buildByQuery(selector) {
        document.querySelectorAll(selector).forEach(this.build, this);
    }

    /**
     * Given an element, delegate to the appropriate builder based on its type
     *
     * @param element
     * @returns {*}
     */
    build(element) {
        switch (element.nodeName) {
            case 'TEXTAREA':
                return this.buildOnTextarea(element);
            case 'DIV':
                return this.buildOnDiv(element);
            case 'IFRAME':
                return this.buildOnIFrame(element);
            default:
                return false;
        }
    }

    /**
     * Get initial value from supplied textarea and create other elements
     * Then delegate to assemble()
     *
     * @param element
     */
    buildOnTextarea(element) {
        let textarea = element;
        let div = document.createElement('div');
        let iframe = document.createElement('iframe');
        let content = element.value;
        let width = element.offsetWidth;
        let height = element.offsetHeight;
        textarea.style = '';

        textarea.parentNode.insertBefore(div, textarea);
        textarea.parentNode.removeChild(textarea);

        this.assemble(textarea, div, iframe, content);
        div.style.height = height + 'px';
        div.style.width = width + 'px';
        if (element.hasAttribute('data-chalk-class')) {
            div.classList.add(element.getAttribute('data-chalk-class'));
        } else {
            div.classList.add('chalk-text-hide');
        }
    }

    /**
     * Get initial value from supplied div and create other elements
     * Then delegate to assemble()
     *
     * @param element
     */
    buildOnDiv(element) {
        let textarea = document.createElement('textarea');
        let div = element;
        let iframe = document.createElement('iframe');
        let content = element.innerHTML;
        div.style.width = element.clientWidth;
        div.style.height = element.clientHeight;
        element.innerHTML = '';

        this.assemble(textarea, div, iframe, content);
    }

    /**
     * Get initial value from supplied iframe and create other elements
     * Then delegate to assemble()
     *
     * @param element
     */
    buildOnIFrame(element) {
    }

    /**
     * Given the key elements and inital value, assemble them in the DOM
     * and attach event handlers
     *
     * @param textarea
     * @param div
     * @param iframe
     * @param content
     */
    assemble(textarea, div, iframe, content) {
        this.textarea = textarea;
        this.iframe = iframe;
        this.rootDiv = div;

        textarea.classList.add('chalk-source');
        div.classList.add('chalk-root');
        iframe.classList.add('chalk-frame');

        div.innerHTML = '';
        div.appendChild(this.getToolbar(iframe));
        div.appendChild(textarea);
        div.appendChild(iframe);

        textarea.value = content;
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(content);
        iframe.contentWindow.document.close();
        iframe.contentWindow.document.designMode = 'on';

        textarea.addEventListener('keyup', this.textareaKeyUpHandler.bind(this));
        textarea.addEventListener('keydown', this.textareaKeyDownHandler.bind(this));

        iframe.contentWindow.document.addEventListener('keyup', this.iframeKeyUpHandler.bind(this))
    }

    /**
     * Event handler for changes in the iframe
     * Updates the textarea value
     *
     * @param event
     */
    iframeKeyUpHandler(event) {
        // TODO: Should this be an option?
        // this.textarea.value = this.iframe.contentWindow.document.body.parentNode.outerHTML;
        this.textarea.value = this.iframe.contentWindow.document.body.innerHTML;
    }

    /**
     * Event handler for changes in the textarea
     *
     * @param event
     */
    textareaKeyUpHandler(event) {
        this.iframe.contentWindow.document.open();
        this.iframe.contentWindow.document.write(this.textarea.value);
        this.iframe.contentWindow.document.close();
    }

    /**
     * Event handler for capturing tabs and newlines in the textarea
     * Adds support for autoindent and multiline tabbing
     *
     * @param event
     * @returns {boolean}
     */
    textareaKeyDownHandler(event) {
        let textarea = event.target;
        let start = textarea.selectionStart;
        let end = textarea.selectionEnd;
        let tab = this.tab;

        // Handle tabs
        if (9 == event.which) {
            textarea.focus();

            let newText = tab;

            let texts = textarea.value.substring(start, end).split('\n');
            if (texts.length > 1) { //multi-line selection!
                start = textarea.value.lastIndexOf('\n', start + 1);
                if (start == -1) {
                    start = 0;
                }
                if (textarea.value.charCodeAt(end) == 10) {
                    end -= 1;
                }
                let before = textarea.value.substring(0, start);
                let oldText = textarea.value.substring(start, end);
                let after = textarea.value.substring(end);
                texts = oldText.split('\n');
                if (event.shiftKey) {
                    newText =
                        oldText.replace(new RegExp('\n' + tab, 'g'), '\n').replace(new RegExp('^' + tab, ''), '');
                } else {
                    newText = (start == 0 ? tab : '') + texts.join('\n' + tab);
                }

                textarea.value = before + newText + after;
                textarea.setSelectionRange(start, start + newText.length);
            } else {
                textarea.value = textarea.value.substring(0, start)
                    + tab
                    + textarea.value.substring(end);
                textarea.setSelectionRange(start + tab.length, start + tab.length);
            }
            event.preventDefault();
            return false;

        }

        // Handle newlines
        if (13 == event.which) {
            if (start == 0) {
                return true;
            }

            let prevLine = textarea.value.substring(0, start).lastIndexOf('\n');
            if (prevLine == -1) {
                prevLine = 0;
            }

            let bits = /^\n?([\t ]*)[^\t ]?/.exec(textarea.value.substring(prevLine, start));
            if (!bits || bits[1].length == 0) {
                return true;
            }

            textarea.value = textarea.value.substring(0, start)
                + '\n' + bits[1]
                + textarea.value.substring(end);
            textarea.setSelectionRange(start + bits[1].length + 1, start + bits[1].length + 1);

            event.preventDefault();

            return false;
        }

    }

    /**
     * Builds a toolbar
     * Sets tools to support feather icons, but have default text labels
     *
     * @param iframe
     * @returns {HTMLElement}
     */
    getToolbar(iframe) {
        let toolbar, tool, tools, inner, handler;
        toolbar = document.createElement('div');
        toolbar.classList.add('chalk-toolbar');

        tools = [
            ['text-only', 'code'],
            ['text-left', 'arrow-left'],
            ['text-top', 'arrow-up'],
            ['text-right', 'arrow-right'],
            ['text-hide', 'edit']
        ];
        handler = function(newClass, tools) {
            return function(event) {
                for (let j = 0; j < tools.length; j++) {
                    toolbar.parentElement.classList.remove('chalk-' + tools[j][0]);
                }
                toolbar.parentElement.classList.add(newClass);
                event.preventDefault();
            }
        };
        for (let i = 0; i < tools.length; i++) {
            tool = document.createElement('span');
            tool.classList.add('tool-' + tools[i][0]);
            inner = document.createElement('span');
            inner.innerText = tools[i][0];
            inner.setAttribute('data-feather', tools[i][1]);
            tool.appendChild(inner);

            tool.addEventListener('click', handler('chalk-' + tools[i][0], tools));
            toolbar.appendChild(tool);
        }

        tools = [
            ['bold', 'bold'],
            ['italic', 'italic'],
            ['underline', 'underline'],
            ['strikeThrough', 'minus'],
        ];
        for (let i = 0; i < tools.length; i++) {
            tool = document.createElement('span');
            inner = document.createElement('span');
            inner.innerText = tools[i][0];
            inner.setAttribute('data-feather', tools[i][1]);
            tool.appendChild(inner);
            tool.addEventListener('click', function(event) {
                this.iframe.contentWindow.document.execCommand(tools[i][0]);
                this.iframeKeyUpHandler();
                event.preventDefault();
            }.bind(this));
            toolbar.appendChild(tool);
        }

        return toolbar;
    }

    /**
     * Applies provided styles to the current DOM/CSSOM
     *
     * @param styles
     * @returns {StyleSheet}
     */
    static applyStylesheet(styles) {
        let sheet, element = document.createElement('style');
        document.head.appendChild(element);
        sheet = element.sheet;
        styles = styles.reverse();
        for (let i = 0; i < styles.length; i++) {
            sheet.insertRule(styles[i]);
        }
        return sheet;
    }

    /**
     * Returns an array of CSS Rules suitable for Chalk
     *
     * @returns {string[]}
     */
    static getDefaultStylesheet() {
        return [
// Reset
            `div.chalk-root, textarea.chalk-source, iframe.chalk-frame, div.chalk-toolbar {
    margin: 0;
    border: 0;
    width: 100%;
    height: 100%;
    resize: none;
    border: 1px solid black;
    box-sizing: border-box;
}`,
            `div.chalk-root {
    resize: vertical;
    overflow: hidden;
    padding: 0;
}`,
            `textarea.chalk-source, iframe.chalk-frame {
    height: calc(100% - 30px);
}`,
// Layout
            `div.chalk-root.chalk-text-left > textarea.chalk-source, div.chalk-root.chalk-text-right > iframe.chalk-frame {
    width: 50%;
    float:left;
}`,
            `div.chalk-root.chalk-text-left > iframe.chalk-frame, div.chalk-root.chalk-text-right > textarea.chalk-source {
    width: 50%;
    float: right;
}`,
            `div.chalk-root.chalk-text-top > iframe.chalk-frame, div.chalk-root.chalk-text-top > textarea.chalk-source {
    height: 50%;
    height: calc(50% - 15px);
}`,
            `div.chalk-root.chalk-text-only > iframe.chalk-frame, div.chalk-root.chalk-text-hide > textarea.chalk-source {
    display: none;
}`,
            `div.chalk-toolbar > span {
    margin: 1px 5px;
}`,
            `div.chalk-toolbar > span[class|="tool-text"] {
    float: right;
}`,

            `div.chalk-toolbar {
    height: 30px;
    display: block;
    border-bottom: 1px inset black;
}`, `
div.chalk-root > textarea.chalk-source {
    font :10pt monospace;
    -moz-tab-size: 4;
    -o-tab-size: 4;
    -webkit-tab-size: 4;
    tab-size: 4;
}`
        ];
    }

}
