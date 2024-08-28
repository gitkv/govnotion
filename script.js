document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const commandPalette = document.getElementById('command-palette');
    const newPageBtn = document.getElementById('new-page-btn');
    const pageList = document.getElementById('page-list');
    const searchInput = document.getElementById('search-input');
    const tagInput = document.getElementById('tag-input');
    const tagsList = document.getElementById('tags-list');
    const toolbar = document.querySelector('.toolbar');
    const insertImageBtn = document.getElementById('insert-image-btn');
    const imageUpload = document.getElementById('image-upload');
    const exportBtn = document.getElementById('export-btn');
    const pageTitleInput = document.getElementById('page-title');
    let pages = JSON.parse(localStorage.getItem('pages')) || [];
    let currentPageId = localStorage.getItem('currentPageId');
    const turndownService = new TurndownService();
    const resetBtn = document.getElementById('reset-btn');


    let undoStack = [];
    let redoStack = [];

    editor.addEventListener('input', handleInput);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('click', handleTodoItemClick);
    document.addEventListener('keydown', handleUndoRedo);
    commandPalette.addEventListener('click', handleCommandSelection);
    newPageBtn.addEventListener('click', () => createNewPage());
    searchInput.addEventListener('input', handleSearch);
    tagInput.addEventListener('keydown', handleTagInput);
    toolbar.addEventListener('click', handleToolbarClick);
    insertImageBtn.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', handleImageUpload);
    exportBtn.addEventListener('click', exportCurrentPage);
    pageTitleInput.addEventListener('input', handleTitleChange);
    resetBtn.addEventListener('click', resetApp);

    // Initialize Sortable
    new Sortable(pageList, {
        animation: 150,
        ghostClass: 'dragging',
        onEnd: updatePagesOrder
    });

    function handleInput(e) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '/') {
            showCommandPalette(range);
        } else {
            hideCommandPalette();
        }

        if (currentPageId) {
            const currentPage = pages.find(page => page.id === currentPageId);
            if (currentPage) {
                currentPage.content = editor.innerHTML;
                saveState();
                pushToUndoStack();
            }
        }
    }

    function handleTodoItemClick(e) {
        if (e.target.type === 'checkbox' && e.target.parentElement.classList.contains('todo-item')) {
            toggleTodoItemStrike(e);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const startNode = range.startContainer;
            const listItem = startNode.closest('li');
    
            if (listItem && listItem.classList.contains('todo-item')) {
                e.preventDefault();
                const todoList = listItem.closest('.todo-list');
                const newItem = createTodoItem('');
    
                if (listItem.querySelector('span').textContent.trim() === '') {
                    // If the current item is empty, remove it and move out of the list
                    listItem.remove();
                    if (todoList.children.length === 0) {
                        todoList.remove();
                    }
                    const newParagraph = document.createElement('p');
                    newParagraph.innerHTML = '<br>';
                    range.insertNode(newParagraph);
                    range.setStartAfter(newParagraph);
                } else {
                    // Insert new todo item after the current one
                    listItem.after(newItem);
                    range.setStart(newItem.querySelector('span'), 0);
                }
    
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                saveState();
                pushToUndoStack();
            }
        }
    }

    function handleUndoRedo(e) {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    }

    function pushToUndoStack() {
        undoStack.push(editor.innerHTML);
        redoStack = []; // Clear redo stack when a new change is made
    }

    function undo() {
        if (undoStack.length > 1) {
            redoStack.push(undoStack.pop());
            editor.innerHTML = undoStack[undoStack.length - 1];
            saveState();
        }
    }

    function redo() {
        if (redoStack.length > 0) {
            undoStack.push(redoStack.pop());
            editor.innerHTML = undoStack[undoStack.length - 1];
            saveState();
        }
    }

    function showCommandPalette(range) {
        const rect = range.getBoundingClientRect();
        commandPalette.style.top = `${rect.bottom}px`;
        commandPalette.style.left = `${rect.left}px`;
        commandPalette.classList.remove('hidden');
    }

    function hideCommandPalette() {
        commandPalette.classList.add('hidden');
    }

    function handleCommandSelection(e) {
        if (e.target.classList.contains('command-item')) {
            const type = e.target.dataset.type;
            insertBlock(type);
            hideCommandPalette();
        }
    }

    function insertBlock(type) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        let block;

        switch (type) {
            case 'bullet-list':
                block = document.createElement('ul');
                block.innerHTML = '<li></li>';
                break;
            case 'numbered-list':
                block = document.createElement('ol');
                block.innerHTML = '<li></li>';
                break;
            case 'todo':
                block = document.createElement('ul');
                block.classList.add('todo-list');
                block.innerHTML = '<li class="todo-item"><input type="checkbox"><span contenteditable="true"></span></li>';
                break;
            default:
                block = document.createElement(getElementForType(type));
                block.classList.add(type);
        }

        if (node.nodeType === Node.TEXT_NODE) {
            node.parentNode.replaceChild(block, node);
        } else {
            node.appendChild(block);
        }

        range.setStart(block.querySelector('span') || block, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        block.focus();
        saveState();
        pushToUndoStack();
    }

    function getElementForType(type) {
        switch (type) {
            case 'text': return 'p';
            case 'heading1': return 'h1';
            case 'heading2': return 'h2';
            default: return 'p';
        }
    }

    function createNewPage(title = null, parentId = null) {
        const pageTitle = title || `New Page ${pages.length + 1}`;
        const newPage = { 
            id: Date.now().toString(), 
            title: pageTitle, 
            content: '', 
            tags: [],
            parentId: parentId
        };
        pages.push(newPage);
        updatePageList();
        setActivePage(newPage.id);
        saveState();
    }

    function updatePageList(pagesToShow = null) {
        pageList.innerHTML = '';
        const pagesToDisplay = pagesToShow || pages;
        const topLevelPages = pagesToDisplay.filter(page => !page.parentId);
        topLevelPages.forEach(page => {
            const pageElement = createPageElement(page);
            pageList.appendChild(pageElement);
        });
    }

    function createPageElement(page, level = 0.5) {
        const pageElement = document.createElement('div');
        pageElement.classList.add('page-list-item');
        pageElement.textContent = page.title;
        pageElement.dataset.id = page.id;

        // Add delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.classList.add('delete-page-btn');
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering page click event
            deletePage(page.id);
        });
        pageElement.appendChild(deleteButton);

        // Добавляем обработчик клика для переключения страниц
        pageElement.addEventListener('click', () => {
            setActivePage(page.id);
        });

        // Add child pages
        const childPages = pages.filter(childPage => childPage.parentId === page.id);
        if (childPages.length > 0) {
            const childrenContainer = document.createElement('div');
            childPages.forEach(childPage => {
                const childElement = createPageElement(childPage, level + 1);
                childrenContainer.appendChild(childElement);
            });
            pageElement.appendChild(childrenContainer);
        }

        return pageElement;
    }

    function deletePage(pageId) {
        if (confirm('Are you sure you want to delete this page?')) {
            // Remove the page and its children
            const deleteRecursive = (id) => {
                pages = pages.filter(page => page.id !== id);
                pages.forEach(page => {
                    if (page.parentId === id) {
                        deleteRecursive(page.id);
                    }
                });
            };
    
            deleteRecursive(pageId);
    
            // Update the page list
            updatePageList();
    
            // Set the active page to null if the deleted page was active
            if (currentPageId === pageId) {
                currentPageId = null;
                editor.innerHTML = '';
                pageTitleInput.value = '';
                tagsList.innerHTML = '';
            }
    
            saveState();
        }
    }

    function setActivePage(pageId) {
        currentPageId = pageId;
        const currentPage = pages.find(page => page.id === pageId);
        if (currentPage) {
            pageTitleInput.value = currentPage.title;
            editor.innerHTML = currentPage.content;
            updateTagsList();
            saveState();
            undoStack = [editor.innerHTML];
            redoStack = [];
        }
    }

    function resetApp() {
        if (confirm('Are you sure you want to reset the entire app? This will delete all pages.')) {
            pages = [];
            currentPageId = null;
            updatePageList();
            editor.innerHTML = '';
            pageTitleInput.value = '';
            tagsList.innerHTML = '';
            saveState();
        }
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPages = pages.filter(page => 
            page.title.toLowerCase().includes(searchTerm) || 
            page.content.toLowerCase().includes(searchTerm) ||
            page.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        // Pass filtered pages to updatePageList
        updatePageList(filteredPages);
    }

    function handleTagInput(e) {
        if (e.key === 'Enter' && e.target.value.trim()) {
            addTag(e.target.value.trim());
            e.target.value = '';
        }
    }

    function addTag(tagName) {
        if (currentPageId) {
            const currentPage = pages.find(page => page.id === currentPageId);
            if (currentPage && !currentPage.tags.includes(tagName)) {
                currentPage.tags.push(tagName);
                updateTagsList();
                saveState();
            }
        }
    }

    function updateTagsList() {
        tagsList.innerHTML = '';
        if (currentPageId) {
            const currentPage = pages.find(page => page.id === currentPageId);
            if (currentPage) {
                currentPage.tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.classList.add('tag');
                    tagElement.textContent = tag;
                    const removeButton = document.createElement('span');
                    removeButton.classList.add('remove-tag');
                    removeButton.textContent = '×';
                    removeButton.addEventListener('click', () => removeTag(tag));
                    tagElement.appendChild(removeButton);
                    tagsList.appendChild(tagElement);
                });
            }
        }
    }

    function removeTag(tagName) {
        if (currentPageId) {
            const currentPage = pages.find(page => page.id === currentPageId);
            if (currentPage) {
                currentPage.tags = currentPage.tags.filter(tag => tag !== tagName);
                updateTagsList();
                saveState();
            }
        }
    }

    function handleToolbarClick(e) {
        if (e.target.closest('button')) {
            const button = e.target.closest('button');
            const command = button.dataset.command;
            
            if (command === 'insertTodoList') {
                e.preventDefault();
                insertTodoList();
            } else {
                document.execCommand(command, false, null);
            }
            
            updateToolbarState();
            saveState();
            pushToUndoStack();
        }
    }
    
    function insertTodoList() {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const selectedContent = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(selectedContent);
    
        // Разделяем содержимое на строки, сохраняя HTML-форматирование
        const lines = tempDiv.innerHTML.split(/<div>|<\/div>|<p>|<\/p>|<br>/).filter(line => line.trim() !== '');
    
        const todoList = document.createElement('ul');
        todoList.classList.add('todo-list');
    
        lines.forEach(line => {
            const listItem = createTodoItem(line.trim());
            todoList.appendChild(listItem);
        });
    
        range.deleteContents();
        range.insertNode(todoList);
    
        // Установить курсор в конец списка
        const lastSpan = todoList.querySelector('li:last-child span');
        if (lastSpan) {
            const newRange = document.createRange();
            newRange.setStartAfter(lastSpan);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    
        saveState();
        pushToUndoStack();
    }
    
    function createTodoItem(content) {
        const listItem = document.createElement('li');
        listItem.classList.add('todo-item');
    
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', toggleTodoItemStrike);
    
        const span = document.createElement('span');
        span.contentEditable = true;
        span.innerHTML = content; // Используем innerHTML вместо textContent для сохранения форматирования
    
        listItem.appendChild(checkbox);
        listItem.appendChild(span);
    
        return listItem;
    }
    
    function toggleTodoItemStrike(e) {
        const checkbox = e.target;
        const span = checkbox.nextElementSibling;
        if (checkbox.checked) {
            span.style.textDecoration = 'line-through';
        } else {
            span.style.textDecoration = 'none';
        }
        saveState();
        pushToUndoStack();
    }

    function updateToolbarState() {
        const buttons = toolbar.querySelectorAll('button');
        buttons.forEach(button => {
            const command = button.dataset.command;
            if (command === 'insertTodoList') {
                // Check if the cursor is inside a todo list
                const selection = window.getSelection();
                const node = selection.anchorNode;
                const isTodoList = node.nodeType === 1 ? node.closest('.todo-list') : node.parentElement.closest('.todo-list');
                button.classList.toggle('active', !!isTodoList);
            } else if (document.queryCommandState(command)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
  
    function updatePagesOrder() {
        const newOrder = Array.from(pageList.children).map(el => el.dataset.id);
        pages = newOrder.map(id => pages.find(page => page.id === id));
        saveState();
    }

    function saveState() {
        localStorage.setItem('pages', JSON.stringify(pages));
        localStorage.setItem('currentPageId', currentPageId);
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = document.createElement('img');
                img.src = event.target.result;
                editor.focus();
                document.execCommand('insertHTML', false, img.outerHTML);
                saveState();
                pushToUndoStack();
            }
            reader.readAsDataURL(file);
        }
    }

    function exportCurrentPage() {
        if (currentPageId) {
            const currentPage = pages.find(page => page.id === currentPageId);
            if (currentPage) {
                const markdown = turndownService.turndown(currentPage.content);
                const blob = new Blob([markdown], {type: "text/markdown;charset=utf-8"});
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${currentPage.title}.md`;
                link.click();
            }
        }
    }

    function handleTitleChange(e) {
        if (currentPageId) {
            const currentPage = pages.find(page => page.id === currentPageId);
            if (currentPage) {
                currentPage.title = e.target.value;
                updatePageList();
                saveState();
            }
        }
    }

    // Initialize the app
    if (pages.length > 0) {
        updatePageList();
        if (currentPageId && pages.some(page => page.id === currentPageId)) {
            setActivePage(currentPageId);
        } else {
            setActivePage(pages[0].id);
        }
    } else {
        createNewPage();
    }
});