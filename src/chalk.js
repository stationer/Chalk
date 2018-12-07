class Chalk {
    constructor(options = {}) {
        this.tab = options.tab || '    ';
        this.styles = options.styles || Chalk.getDefaultStylesheet();
        this.stylesheet = null;
        if (this.styles && this.styles.length) {
            this.stylesheet = Chalk.applyStylesheet(this.styles);
        }
    }

    buildByQuery(selector) {
        document.querySelectorAll(selector).forEach(this.build, this);
    }

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

    buildOnIFrame(element) {
    }

    assemble(textarea, div, iframe, content) {
        textarea.classList.add('chalk-source');
        div.classList.add('chalk-root');
        iframe.classList.add('chalk-frame');

        div.innerHTML = '';
        div.appendChild(this.getToolbar());
        div.appendChild(textarea);
        div.appendChild(iframe);

        textarea.value = content;
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(content);
        iframe.contentWindow.document.close();
        iframe.contentWindow.document.designMode = 'on';

        textarea.addEventListener('keyup', function() {
            iframe.contentWindow.document.open();
            iframe.contentWindow.document.write(textarea.value);
            iframe.contentWindow.document.close();
        });
        textarea.addEventListener('keydown', this.textareaKeyDownHandler.bind(this));

        iframe.contentWindow.document.addEventListener('keyup', function() {
            textarea.value = iframe.contentWindow.document.body.parentNode.outerHTML;
            textarea.value = iframe.contentWindow.document.body.innerHTML;
        })
    }

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

    getToolbar() {
        let toolbar, tool, tools, inner;
        toolbar = document.createElement('div');
        toolbar.classList.add('chalk-toolbar');

        tools = [
            ['text-only', 'code'], 
            ['text-left', 'arrow-left'],
            ['text-top', 'arrow-up'],
            ['text-right', 'arrow-right'],
            ['text-hide', 'edit']
        ];
        for (let i = 0; i < tools.length; i++) {
            tool = document.createElement('span');
            inner = document.createElement('span');
            inner.innerText = tools[i][0];
            inner.setAttribute('data-feather', tools[i][1]);
            tool.appendChild(inner);
            tool.addEventListener('click', function(event) {
                for (let j = 0; j < tools.length; j++) {
                    toolbar.parentElement.classList.remove('chalk-' + tools[j][0]);
                }
                toolbar.parentElement.classList.add('chalk-' + tools[i][0]);
                event.preventDefault();
            });
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
     * Returns an array of CSS Rules suitable for Quill
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
    margin: 2px 10px;
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
