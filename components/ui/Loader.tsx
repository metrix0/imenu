import styles from "./Loader.module.css";

type LoaderProps = {
    className?: string;
};

export default function Loader({ className = "" }: LoaderProps) {
    return (
        <div
            className={`${styles.loader} w-8 h-8 border-4 border-gray-200 border-t-gray-400 rounded-full ${className}`}
        />
    );
}
