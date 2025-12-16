import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import '../App.css';

import {
    Sidebar,
    ReviewMode,
    GeneratingView,
    BoardsView,
    ResearchPanel,
    Lightbox
} from '../components';
import { useLocalStorage, useStoryGeneration, useBoards } from '../hooks';

function Create() {
    // Form state
    const [topic, setTopic] = useState('');
    const [numSlides, setNumSlides] = useState(5);
    const [selectedStyle, setSelectedStyle] = useState(null);
    const [customStyles, setCustomStyles] = useLocalStorage('story-generator-custom-styles', []);
    const [imageSize, setImageSize] = useState('story');
    const [imageProvider, setImageProvider] = useState('fal');
    const [inputMode, setInputMode] = useState('topic');
    const [pastedText, setPastedText] = useState('');

    // Brand state
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);

    // Lightbox state
    const [selectedImage, setSelectedImage] = useState(null);

    // Boards state (persisted to backend)
    const {
        savedResearch,
        savedImageBoards,
        loading: boardsLoading,
        addResearch,
        deleteResearch,
        addImageBoard,
        deleteImageBoard,
    } = useBoards();

    const [activeTab, setActiveTab] = useState('research');
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [selectedResearchBoard, setSelectedResearchBoard] = useState(null);

    // Load brands on mount
    useEffect(() => {
        const loadBrands = async () => {
            try {
                const response = await fetch('http://localhost:8000/brands');
                if (response.ok) {
                    const data = await response.json();
                    setBrands(data.brands || []);
                }
            } catch (err) {
                console.error('Failed to load brands:', err);
            }
        };
        loadBrands();
    }, []);

    // Story generation hook
    const {
        isGenerating,
        generatingPhase,
        storyPlan,
        setStoryPlan,
        expectedSlides,
        currentGeneratingSlide,
        setCurrentGeneratingSlide,
        generatingSlides,
        generatedImages,
        generatedSlides,
        storyCaption,
        storyHashtags,
        completedResearch,
        setCompletedResearch,
        researchCollapsed,
        setResearchCollapsed,
        handleGenerate,
        handleConfirmPlan,
        handleRegenerateImages,
        handleEditAesthetic,
        handleEditSlide,
        handleEditCaption,
        handleCancel,
        updatePlanStyle
    } = useStoryGeneration({
        topic,
        numSlides,
        selectedStyle,
        imageSize,
        imageProvider,
        inputMode,
        pastedText,
        brandId: selectedBrand,
        onSaveResearch: (board) => addResearch(board),
        onSaveImages: (board) => {
            addImageBoard(board);
            setSelectedBoard(board);
            setActiveTab('images');
        }
    });

    // Update plan style when style changes (during review/generation)
    useEffect(() => {
        if (storyPlan && selectedStyle) {
            updatePlanStyle(selectedStyle);
        }
    }, [selectedStyle]);

    // Download handlers
    const handleDownloadImage = async (imageUrl, index) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `slide_${index + 1}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    const handleDownloadAll = async (images, topicName = 'story') => {
        const zip = new JSZip();
        const folder = zip.folder('images');

        for (let i = 0; i < images.length; i++) {
            try {
                const response = await fetch(images[i]);
                const blob = await response.blob();
                folder.file(`slide_${i + 1}.png`, blob);
            } catch (err) {
                console.error(`Failed to add image ${i + 1} to zip:`, err);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const safeName = topicName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        saveAs(content, `${safeName}_images.zip`);
    };

    // Delete handlers
    const handleDeleteResearch = (researchId) => {
        deleteResearch(researchId);
    };

    const handleDeleteImages = (boardId) => {
        deleteImageBoard(boardId);
    };

    // Open review mode for regeneration from research board
    const handleReviewForRegenerate = (research) => {
        setSelectedResearchBoard(null);
        // Format research as storyPlan to trigger ReviewMode
        // Use selectedStyle from sidebar if available, otherwise use research's aesthetic
        setStoryPlan({
            topic: research.topic,
            aesthetic: selectedStyle || research.aesthetic,
            slides: research.slides,
            caption: research.caption,
            hashtags: research.hashtags,
            sources: research.sources,
            image_size: research.image_size || imageSize,
            isFromResearch: true  // Flag to know this came from saved research
        });
    };

    // Confirm plan and set board
    const handleConfirmAndSetBoard = async () => {
        const newBoard = await handleConfirmPlan();
        if (newBoard) {
            setSelectedBoard(newBoard);
            setActiveTab('images');
        }
    };

    // Determine main content view
    const renderMainContent = () => {
        // Review mode - show plan for editing (takes priority)
        if (storyPlan && !generatedImages.length && !isGenerating) {
            return (
                <ReviewMode
                    storyPlan={storyPlan}
                    selectedStyle={selectedStyle}
                    onEditAesthetic={handleEditAesthetic}
                    onEditSlide={handleEditSlide}
                    onEditCaption={handleEditCaption}
                    onConfirmPlan={handleConfirmAndSetBoard}
                />
            );
        }

        // Generating view - show progress
        if (isGenerating) {
            return (
                <div className="generation-live">
                    <GeneratingView
                        generatingPhase={generatingPhase}
                        topic={topic}
                        currentGeneratingSlide={currentGeneratingSlide}
                        setCurrentGeneratingSlide={setCurrentGeneratingSlide}
                        expectedSlides={expectedSlides}
                        generatingSlides={generatingSlides}
                    />
                </div>
            );
        }

        // Loading state for boards
        if (boardsLoading) {
            return (
                <div className="empty-state">
                    <p>Loading...</p>
                </div>
            );
        }

        // Default - show boards
        return (
            <BoardsView
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                savedResearch={savedResearch}
                savedImageBoards={savedImageBoards}
                selectedBoard={selectedBoard}
                setSelectedBoard={setSelectedBoard}
                selectedResearchBoard={selectedResearchBoard}
                setSelectedResearchBoard={setSelectedResearchBoard}
                selectedStyle={selectedStyle}
                onImageClick={setSelectedImage}
                onDownloadImage={handleDownloadImage}
                onDownloadAll={handleDownloadAll}
                onReviewForRegenerate={handleReviewForRegenerate}
                onDeleteResearch={handleDeleteResearch}
                onDeleteImages={handleDeleteImages}
            />
        );
    };

    return (
        <div className="create-page">
            <Sidebar
                topic={topic}
                setTopic={setTopic}
                numSlides={numSlides}
                setNumSlides={setNumSlides}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}
                customStyles={customStyles}
                setCustomStyles={setCustomStyles}
                imageSize={imageSize}
                setImageSize={setImageSize}
                imageProvider={imageProvider}
                setImageProvider={setImageProvider}
                inputMode={inputMode}
                setInputMode={setInputMode}
                pastedText={pastedText}
                setPastedText={setPastedText}
                isGenerating={isGenerating}
                generatingPhase={generatingPhase}
                storyPlan={storyPlan}
                setStoryPlan={setStoryPlan}
                currentGeneratingSlide={currentGeneratingSlide}
                expectedSlides={expectedSlides}
                onGenerate={handleGenerate}
                onCancel={handleCancel}
                brands={brands}
                selectedBrand={selectedBrand}
                setSelectedBrand={setSelectedBrand}
            />

            {!isGenerating && (
                <ResearchPanel
                    completedResearch={completedResearch}
                    setCompletedResearch={setCompletedResearch}
                    researchCollapsed={researchCollapsed}
                    setResearchCollapsed={setResearchCollapsed}
                    onRegenerateImages={handleRegenerateImages}
                />
            )}

            <main className="main-content">
                {renderMainContent()}
            </main>

            <Lightbox
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                generatedImages={generatedImages}
                generatedSlides={generatedSlides}
                storyCaption={storyCaption}
                storyHashtags={storyHashtags}
                topic={topic}
                onDownloadImage={handleDownloadImage}
            />
        </div>
    );
}

export default Create;
