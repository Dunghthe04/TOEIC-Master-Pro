//Component dùng lại được cho soạn thảo rich text (nội dung câu hỏi, giải thích).

//useEditor là hook tạo editor
//EditorContent là component hiển thị nội dung.
//StarterKit là bộ chức năng mặc định của TipTap: BOLD, ITALIC, PARAGRAPH,...
//onUpdate: call mỗi khi nội dung thay đổi
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from 'react'

//Dữ liệu của component được truyền từ ngoài vào (parent component)
interface Props {
    value: string,
    //callback function, mỗi lần editor thay đổi thì return về parent component
    onChange: (html: string) => void
    placeholder?: string
}


export default function RichTextEditor({ value, onChange, placeholder }: Props) {
    const editor = useEditor({
        //đăng kí các tính năng
        extensions: [StarterKit],
        //nội dung ban đầu
        content: value,
        //mỗi khi nội dung thay đổi thì gọi callback function
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    })


    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            //set lại nội dung editor khi nhận prop value từ ngoài vào
            editor.commands.setContent(value);
        }
    }, [value])
    return (
        <div className="border rounded-md min-h-[120px] focus-within:ring-2 focus-within:ring-ring">
            <div className="flex gap-1 border-b px-2 py-1">
                <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={`px-2 py-0.5 text-sm rounded ${editor?.isActive('bold') ? 'bg-muted font-bold' : 'hover:bg-muted'}`}
                >B</button>
                <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={`px-2 py-0.5 text-sm rounded italic ${editor?.isActive('italic') ? 'bg-muted' : 'hover:bg-muted'}`}
                >I</button>
                <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    className={`px-2 py-0.5 text-sm rounded ${editor?.isActive('bulletList') ? 'bg-muted' : 'hover:bg-muted'}`}
                >• List</button>
            </div>
            <EditorContent
                editor={editor}
                className="p-3 text-sm outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px]"
                placeholder={placeholder}
            />
        </div>
    )

}

